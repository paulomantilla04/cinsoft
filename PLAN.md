# PLAN — CINSOFT 2026 // Registro a Talleres

App de 3 pantallas para recibir registros a talleres del congreso, con panel administrativo protegido.

**Stack:** Next.js 16 (App Router) · Convex · Better Auth (`@convex-dev/better-auth`) · Tailwind v4 · Motion

**Rutas:**

| Ruta | Acceso | Descripción |
|---|---|---|
| `/registro` | Público (ruta principal) | Formulario de inscripción |
| `/dashboard` | Protegida | Tabla de registros + métricas |
| `/estatus` | Público | Consulta de inscripción por cuenta o correo |
| `/login` | Público | Acceso admin (sin signup) |

> `/` hace `redirect('/registro')`.

---

## 0. Regla de trabajo: el HTML manda

Cada pantalla se construye **a partir del HTML ya diseñado**. No se empieza una pantalla sin tener su HTML a la mano.

| Pantalla | Archivo HTML | Estado |
|---|---|---|
| `/registro` | `form.html` | ✅ recibido |
| `/dashboard` | `dashboard.html` | ✅ recibido |
| `/login` | `login.html` | ✅ recibido |
| `/estatus` | — (sin mock) | ✅ diseñada en el mismo lenguaje |

Proceso por pantalla:

1. Leer el HTML y extraer el markup completo (incluyendo shadows, borders, badges, textos de terminal).
2. Portarlo a JSX **respetando clases 1:1**. Nada de "mejorar" el diseño ni redondear esquinas.
3. Sustituir los `<script>` de demo (simulaciones con `setTimeout`, `alert`) por lógica real de Convex.
4. Agregar animaciones con Motion **encima** del layout, sin alterarlo.

Reglas de fidelidad:

- `borderRadius` global = `0px` (excepto `full` para el avatar del header). Brutalismo: bordes de 2–4px y sombras duras `shadow-[6px_6px_0px_#000000]`.
- Los textos de terminal (`SYS_STATUS`, `AUTH_PROTOCOL_0x4F`, `SEC_GATE // NODE_01`, etc.) se conservan tal cual.
- El footer `SYSTEM CODE: PAULOMANTILLADEV` se mantiene en las 3 pantallas.

---

## 1. Setup base

### 1.1 Proyecto — ✅ HECHO

Versiones realmente instaladas:

| Paquete | Versión | Nota |
|---|---|---|
| `next` | 16.3.4 | React 19.2.8 |
| `convex` | 1.45.0 | cumple el `^1.25` que pide el componente |
| `@convex-dev/better-auth` | 0.12.5 | |
| `better-auth` | 1.6.30 | **el pin `1.5.3` del plan original era incorrecto**: el componente exige `>=1.6.11 <1.7.0` |
| `tailwindcss` | 4.3.3 | vía `@tailwindcss/postcss` |
| `motion` | 13.2.0 | |
| `react-hook-form` / `zod` / `@hookform/resolvers` | 7.87.0 / 4.5.4 / 5.9.1 | |

Convex ya está vinculado (`CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` en `.env.local`).

> Verificar siempre el rango de `better-auth` que declara el componente antes de actualizar: <https://labs.convex.dev/better-auth/framework-guides/next>

### 1.2 Tailwind — ✅ HECHO (v4, no v3)

Se optó por **Tailwind v4**: el bloque `tailwind.config` de los HTML está traducido a `@theme` en `app/globals.css`, no a un `tailwind.config.ts`. Bajar a v3 no compensaba con Next 16. Todas las clases del markup funcionan igual.

Equivalencias usadas:

| Config v3 | `@theme` v4 |
|---|---|
| `colors` | `--color-*` |
| `borderRadius` | `--radius-*` (todo a `0px`; `rounded-full` es nativo en v4) |
| `spacing` | `--spacing-*` |
| `fontFamily` | `--font-*` |
| `fontSize` | `--text-*` + `--text-*--line-height` / `--letter-spacing` / `--font-weight` |

Además:

- Fuentes con `next/font/google` (Space Grotesk 700, JetBrains Mono 400/700).
- **Material Symbols self-hosteada** con `next/font/local` (`app/fonts/material-symbols-outlined.woff2`). No se usa el `<link>` a Google: ese CSS va **sin `@layer`** y en Tailwind v4 lo no-capado gana sobre las utilities, así que su `font-size: 24px` pisaba los `text-[18px]` de los iconos. La clase `.material-symbols-outlined` se define a mano dentro de `@layer base`.
- `darkMode: "class"` resultó innecesario: el markup no usa ni una variante `dark:`, los colores son fijos. Se conserva `<html class="dark">` por fidelidad y se añade `color-scheme: dark` para que `<select>`/`<option>` nativos se pinten oscuros.
- CSS global: `.bg-dot-matrix`, `::-webkit-scrollbar { display: none }`, `overscroll-behavior: none` y un bloque `prefers-reduced-motion`.

### 1.3 Layout compartido — ✅ HECHO

Header fijo (`h-20`, `border-b-4 border-primary`, logo CINSOFT) y footer son idénticos en las 3 páginas → `components/site-header.tsx` y `components/site-footer.tsx`, montados en `app/layout.tsx`. El header en sí es igual en las 3 (el usuario autenticado va en la barra de telemetría del dashboard, no en el header); solo cambia el badge `v26.0 // CONGRESS` vs `CONGRESO`, expuesto como prop.

---

## 2. Modelo de datos (Convex) — ✅ HECHO

```ts
// convex/schema.ts
workshops: defineTable({
  name: v.string(),         // "Inteligencia Artificial & LLMs"
  keyword: v.string(),      // "IA & LLMS"  -> lo que se ve en el badge de la tabla
  slug: v.string(),         // "ia" -> valor del <option> y del filtro (data-track)
  capacity: v.number(),     // 15 / 20 / 25 ... por taller
  enrolled: v.number(),     // contador denormalizado
  accent: v.union(          // color del badge en la tabla (el HTML alterna 3)
    v.literal("primary"), v.literal("secondary"), v.literal("tertiary")
  ),
  active: v.boolean(),
  order: v.number(),
}).index("by_slug", ["slug"]),

registrations: defineTable({
  accountNumber: v.string(), // 6 dígitos, se guarda como string (puede iniciar con 0)
  email: v.string(),         // normalizado a minúsculas
  fullName: v.string(),
  group: v.string(),         // "101" … "702"
  workshopId: v.id("workshops"),
})
  .index("by_account", ["accountNumber"])
  .index("by_email", ["email"])
  .index("by_workshop", ["workshopId"]),
```

Notas:

- **`keyword`** es justo lo que pediste: nombre largo en el `<select>` del formulario, keyword corta en el badge del dashboard (`IA & LLMS`, `PYTHON AVANZADO`, `BASES DE DATOS`, `DESARROLLO WEB`, `CIBERSEGURIDAD`).
- **`slug`** sirve doble: `value` del `<option>` y `data-filter` de los tabs del dashboard.
- **`enrolled`** evita contar filas en cada render de las tarjetas de métricas. El `_creationTime` de Convex ya da la fecha de registro (sirve para la métrica "+N en la última hora" y para el orden de la tabla).
- Las tablas de Better Auth las administra el componente, no van en este schema.

---

## 3. Backend Convex

### 3.1 `convex/workshops.ts` — ✅ HECHO

- `list` (query, pública): talleres activos con `name`, `keyword`, `slug`, `capacity`, `enrolled`, `remaining = capacity - enrolled`, `isFull`. Alimenta el `<select>` del formulario, que debe imprimir `NOMBRE (N cupos disp.)` y marcar `disabled` los llenos.
- `stats` (query, protegida): totales para las 4 tarjetas del dashboard — total registrados, talleres activos y cuántos con cupo abierto, taller más solicitado (+ % de ocupación), cupos disponibles globales y % restante.

### 3.2 `convex/registrations.ts` — ✅ HECHO

**`create` (mutation pública)** — el corazón de la app. En orden:

1. Normalizar: `trim`, email a minúsculas, nombre colapsando espacios.
2. Validar (mismo esquema Zod que el cliente):
   - `accountNumber`: exactamente 6 dígitos → `/^\d{6}$/`.
   - `email`: `/^[^\s@]+@uaeh\.edu\.mx$/i`.
   - `fullName`: 3–120 caracteres.
   - `group`: dentro del catálogo de grupos.
   - `workshopId`: existe y `active`.
3. **Duplicados:** buscar por índice `by_account` y por `by_email`. Si cualquiera existe → error `DUPLICATE_ACCOUNT` / `DUPLICATE_EMAIL`. Un alumno = un solo taller.
4. **Cupo:** si `enrolled >= capacity` → error `WORKSHOP_FULL`.
5. `insert` en `registrations` + `patch` de `enrolled + 1` en `workshops`.

> Las mutations de Convex son transaccionales y serializables: leer el cupo e insertar dentro de la misma mutation es atómico. No hace falta lock ni retry. Aquí está la razón principal por la que el cupo **no** se puede validar solo en el cliente.

Errores: lanzar `ConvexError({ code, message })` para poder pintar el banner correcto en la UI.

**`listAll` (query protegida)** — todos los registros con su taller resuelto (`keyword`, `slug`, `accent`), ordenados por `_creationTime` desc. Con el volumen esperado (cientos de filas) se traen completos y se filtra/pagina en cliente; así los tabs, el buscador y los contadores funcionan sin round-trips. Si crece mucho, migrar a `paginate()` con índice.

**`move` (mutation protegida)** — ✅ el botón `[MOVER]` de la tabla: reasigna a un alumno a otro taller. La lógica vive en `convex/lib/registrations.ts` (`applyMove`). Baja el contador del taller origen, sube el del destino y repunta el registro **dentro de la misma mutation**, así que o pasan los tres o no pasa ninguno; sin eso, dos reasignaciones simultáneas dejarían los contadores desalineados con las filas reales. Valida el cupo del destino igual que un alta, y mover a alguien al taller en el que ya está es un no-op (evita que un doble click descuadre los contadores). Sella `reassignedAt` para que `/estatus` pueda avisarle al alumno.

**`remove` (mutation protegida)** — el botón `[BORRAR]` de la tabla: borra el registro y decrementa `enrolled`.

**`exportCsv`** — se genera en el cliente desde los datos ya cargados (Blob + `URL.createObjectURL`). El HTML ya tiene el botón y su animación de "GENERANDO STREAM… / DESCARGA LISTA [OK]"; se conserva y solo se le cuelga la descarga real.

### 3.3 Guard de autorización — ✅ HECHO (`convex/lib/auth.ts`)

Helper `requireAdmin(ctx)` que revisa `ctx.auth.getUserIdentity()` (o el helper del componente de Better Auth) y lanza si no hay sesión. Se aplica en `stats`, `listAll`, `remove` y `workshops.stats`. **La protección de rutas en Next no basta: las queries de Convex son accesibles desde fuera.**

---

## 4. Auth (Better Auth + Convex), sin signup

### 4.1 Configuración

- `convex/convex.config.ts` → `app.use(betterAuth)`.
- `convex/auth.ts` → `createAuth` con `emailAndPassword: { enabled: true }` y **`disableSignUp: true`**.
- `convex/http.ts` → `authComponent.registerRoutes(http, createAuth)`.
- `lib/auth-server.ts` → `convexBetterAuthNextJs({ convexUrl, convexSiteUrl })` exporta `handler`, `isAuthenticated`, `fetchAuthQuery`, etc.
- `app/api/auth/[...all]/route.ts` → `export const { GET, POST } = handler`.
- Provider `ConvexBetterAuthProvider` envolviendo la app.
- Sin OAuth, sin registro, sin recuperación de contraseña: el link "¿OLVIDASTE TU CONTRASEÑA?" del HTML se queda como está (avisa de contactar a soporte).

### 4.2 Inyección de usuarios por CLI

`convex/seed.ts` con una **internal action** que crea el usuario admin usando la API de Better Auth del lado servidor:

```bash
pnpm convex run seed:createAdmin '{"email":"admin@uaeh.edu.mx","password":"...","name":"Root Admin"}'
```

Al ser `internalAction`, no es invocable desde el cliente. Con `disableSignUp: true` hay que crear el usuario por la vía interna del componente (no por el endpoint público de signup); confirmar el método exacto en la doc del componente al implementarlo.

Mismo patrón para sembrar los talleres (ya implementado, idempotente: actualiza
por `slug` y nunca toca `enrolled`, así que se puede re-correr sin perder cupos):

```bash
pnpm convex run seed:seedWorkshops
```

Y para limpiar registros durante el desarrollo:

```bash
pnpm convex run seed:resetRegistrations
```

### 4.3 Protección de `/dashboard`

- **`proxy.ts`** (⚠ en Next 16 el `middleware.ts` se renombró a `proxy.ts`, misma funcionalidad, en la raíz del proyecto): si no hay sesión → redirect a `/login`; si hay sesión y visita `/login` → redirect a `/dashboard`.
- Además, `requireAdmin` en el backend (punto 3.3).
- Botón de logout en el header del dashboard (el HTML tiene el bloque `AUTH_USER: SUPERADMIN_ROOT` en la barra de telemetría → ahí va el email real y el botón).

---

## 5. Pantallas

### 5.1 `/registro` — base `form.html`

Campos (en el orden del HTML): **1. Número de cuenta** · **2. Correo** · **3. Nombre completo** · **4. Grupo** (select 101–702) · **5. Taller** (select desde Convex).

- Los `<select>` conservan el chevron `expand_more` con fondo `primary` y `appearance-none`.
- El badge `#quotaBadge` es dinámico: al elegir taller muestra `[ESTADO: DISPONIBLE]`, `[ESTADO: ÚLTIMOS LUGARES]` (≤ 20% del cupo, color `secondary-container`) o `[ESTADO: CUPO LLENO]`.
- Validación en cliente con `react-hook-form` + Zod (mismo esquema que el server), mensajes en línea bajo cada campo con el estilo de error del HTML.
- El input de cuenta debe forzar solo dígitos y `maxLength = 6` (el HTML trae `maxlength="10"`, se corrige a 6).
- El esquema Zod compartido vive en `lib/validation.ts` y lo importan tanto el form como la mutation de Convex; el catálogo de grupos y accents, en `lib/catalog.ts`.
- Submit: botón pasa a `PROCESANDO MATRÍCULA...` con el spinner `sync animate-spin`; al terminar, `REGISTRO COMPLETADO` y se revela `#statusNotification` con nombre, cuenta, taller y correo.
- Errores del server (duplicado / cupo lleno) → variante roja del mismo banner: `⚠ REGISTRO RECHAZADO // CUENTA YA INSCRITA` etc.
- La copia dice "Comprobante enviado a la bandeja de entrada" → o se implementa correo (Resend en una action) o se ajusta el texto. **Decisión pendiente.**
- Página pública: no debe requerir sesión ni exponer datos de otros registros (la query `list` solo devuelve cupos, no nombres).

### 5.2 `/login` — base `login.html`

- Form con usuario/correo + contraseña, toggle `[SHOW]/[HIDE]` y checkbox "MANTENER SESIÓN".
- Quitar los `value` hardcodeados del HTML (`sysadmin@uaeh.edu.mx`, `CINSOFT_ROOT_2024`) — son del mock.
- El banner `#auth-error-banner` arranca oculto y aparece solo si Better Auth devuelve error. Mensaje genérico, sin distinguir "usuario no existe" de "contraseña incorrecta".
- Botón → `ACCEDIENDO AL SISTEMA...` y luego `router.push('/dashboard')`.

### 5.3 `/dashboard` — base `dashboard.html`

Secciones, de arriba hacia abajo:

1. **Barra de telemetría** — `SYS_STATUS: [ONLINE]`, nodo, `AUTH_USER` real, badge de zona horaria.
2. **Header del panel** — título, métrica global (`REGISTROS: N` + `[X% OCUPADO]`) y estado de matrícula.
3. **4 tarjetas de métricas** — Total registrados (+N en la última hora, calculado con `_creationTime`), Talleres activos (`N de M con cupo abierto`), Más solicitado (keyword + alumnos + % de capacidad; borde `secondary` cuando está crítico), Cupos disponibles (+ % global restante).
4. **Tabs de filtro + buscador** — un tab por taller con su conteo real (`TODOS (148)`, `IA (38)`, …), estado activo `bg-secondary`. Buscador filtra por cuenta o nombre en vivo, `ESC` limpia.
5. **Tabla** — barra de ventana tipo terminal + columnas `# · NÚMERO DE CUENTA · NOMBRE · CORREO · TALLER · GRUPO · ACCIONES`. Filas alternan `surface-container-low` / `surface-container-lowest`. El badge del taller usa `keyword` y el color de `accent`. Acciones `[VER]` (modal con la ficha completa), `[MOVER]` (selector de taller destino → `registrations.move`, que ya existe) y `[BORRAR]` (confirmación antes de la mutation).
6. **Paginación + export** — 7 registros por página como en el HTML, texto `MOSTRANDO 1-7 DE N // PÁGINA 1 DE M`, y `EXPORTAR CSV` real (respetando el filtro/búsqueda activos).
7. **Estado vacío** — no viene en el HTML; hay que diseñarlo en el mismo lenguaje (`NO_RECORDS_FOUND // BUFFER VACÍO`).

Todo es reactivo: al llegar un registro nuevo desde `/registro`, `useQuery` actualiza tabla y métricas solo.

---

### 5.4 `/estatus` — sin mock — ✅ HECHO

Ruta pública para que un alumno consulte en qué taller quedó, escribiendo su
número de cuenta **o** su correo institucional. Existe sobre todo para el caso
en que el admin reasigna a alguien de taller: la card lee en vivo de Convex, así
que siempre refleja el estado actual sin que nadie tenga que avisar.

- Query `registrations.lookup` (pública). El término inválido se detecta en el
  cliente y ni siquiera sale a la red.
- Tres estados: `found` (card con taller, keyword con su accent, grupo, cuenta y
  fecha), `not_found` (banner rojo `NO_RECORD_FOUND // BUFFER VACÍO`) e
  `invalid` (aviso en línea bajo el input).
- **Nombre y correo van enmascarados** (`ALEJANDRO M. S.`, `mo****21@uaeh.edu.mx`):
  el número de cuenta son 6 dígitos y por tanto es enumerable, así que la
  respuesta debe alcanzar para que el alumno se reconozca pero no para cosechar
  datos ajenos. Ver decisión pendiente §8.7.
- Enlazada desde `/registro` y con enlace de vuelta al registro.
- Si el alumno fue reasignado, la card muestra un aviso `REASIGNADO POR COORDINACIÓN` con la fecha del cambio, para que entienda por qué su taller es otro.

## 6. Motion

Discreto y consistente con el brutalismo (movimientos cortos y secos, nada de easing suave y largo):

- **Layout:** transición de entrada por página (`fade + translateY 8px`, ~180ms).
- **`/registro`:** stagger de los 5 bloques del formulario (~40ms entre cada uno); el banner de confirmación entra con `scale 0.96 → 1` y un pequeño desplazamiento de la sombra dura.
- **`/login`:** shake horizontal del card cuando fallan las credenciales; badge de "ACCESO RESTRINGIDO" con el pulso que ya trae el HTML.
- **`/dashboard`:** count-up en los números grandes de las tarjetas, stagger de filas al cambiar de filtro/página (`AnimatePresence` con `layout`), y flash verde en filas nuevas que llegan por reactividad.
- **Botones:** el HTML ya resuelve el press con `active:translate` + `shadow-none`. **No reemplazar eso con Motion**, se duplica el efecto.
- Respetar `prefers-reduced-motion` en todo lo anterior.

---

## 7. Fases

| Fase | Contenido | Bloqueado por |
|---|---|---|
| **F0** ✅ | Proyecto, Tailwind con el theme portado, fuentes, layout con header/footer | — |
| **F1** ✅ | Schema Convex + seed de talleres + queries/mutations de registro | — |
| **F2** | `/registro` completo (UI + validación + mutation + estados de error) | `form.html` ✅ |
| **F3** | Better Auth + seed de admin por CLI + `/login` + middleware | `login.html` ✅ |
| **F4** | `/dashboard`: tabla, tabs, buscador, paginación | `dashboard.html` ✅ |
| **F5** | Métricas, `[VER]`, `[MOVER]` (UI; la mutation ya existe), `[BORRAR]`, export CSV | F4 |
| **F6** | Motion, estados vacíos/carga, responsive, deploy | F2–F5 |

Deploy: Vercel + `pnpm convex deploy`. Variables: `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `BETTER_AUTH_SECRET`, `SITE_URL`.

---

## 8. Decisiones pendientes

1. **Correo de confirmación** — ¿se implementa (Resend + action de Convex) o se ajusta el texto del banner? El HTML promete comprobante por correo.
2. **Catálogo real de talleres** — ⏳ pendiente. Mientras tanto se siembra un **catálogo ficticio** (los 5 del HTML) desde `convex/seed.ts`; sustituirlo es un solo `pnpm convex run` cuando lleguen los datos reales.
3. ~~**Grupos**~~ — ✅ resuelto. Catálogo definitivo: `101, 102, 301, 302, 501, 502, 701, 702`. Los `G-401` / `G-601` / `G-801` del dashboard eran datos de mock y se descartan.
4. **Cierre de registros** — ¿un switch global para cerrar la convocatoria en cierta fecha?
5. ~~**Edición de registros**~~ — ✅ resuelto en backend: `registrations.move` ya reasigna de taller de forma transaccional y sella `reassignedAt`. Falta sólo el botón `[MOVER]` en la tabla del dashboard (F5) y decidir si el admin debe poder **forzar** un movimiento a un taller lleno; hoy se rechaza con `WORKSHOP_FULL`.
6. **Rate limiting** — la mutation de registro es pública. Con el filtro de dominio `@uaeh.edu.mx` + unicidad por cuenta el riesgo es bajo, pero conviene un límite por IP si se expone abierto. Aplica igual a `registrations.lookup`, que es enumerable por número de cuenta.
7. **Nivel de enmascarado en `/estatus`** — hoy la card muestra nombre e email parcialmente ocultos. Alternativas: (a) mostrarlos completos, más cómodo pero deja cosechar datos por fuerza bruta sobre 6 dígitos; (b) exigir cuenta **y** correo juntos, lo más estricto, pero obliga al alumno a recordar ambos. Se eligió el punto medio; cambiarlo es una línea.
