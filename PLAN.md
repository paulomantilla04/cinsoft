# PLAN — CINSOFT 2026 // Registro a Talleres

App de 3 pantallas para recibir registros a talleres del congreso, con panel administrativo protegido.

**Stack:** Next.js (App Router) · Convex · Better Auth (`@convex-dev/better-auth`) · Tailwind · Motion

**Rutas:**

| Ruta | Acceso | Descripción |
|---|---|---|
| `/registro` | Público (ruta principal) | Formulario de inscripción |
| `/dashboard` | Protegida | Tabla de registros + métricas |
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

### 1.1 Proyecto

```bash
pnpm create next-app@latest cinsoft-talleres --ts --tailwind --app --eslint
cd cinsoft-talleres
pnpm add convex
pnpm convex dev            # dejar corriendo
pnpm add -E better-auth@1.5.3
pnpm add @convex-dev/better-auth
pnpm add motion
```

> El componente de Better Auth para Convex requiere Convex ≥ 1.25 y una versión pinneada de Better Auth. Verificar la versión exacta en la doc antes de instalar: <https://labs.convex.dev/better-auth/framework-guides/next>

### 1.2 Tailwind — portar el design system del HTML

Los 3 HTML comparten **el mismo bloque `tailwind.config`** (CDN). Ese bloque se copia tal cual a `tailwind.config.ts` (Tailwind v3) para que todas las clases del markup funcionen sin tocar nada:

- **Colores:** ~45 tokens Material-ish (`primary: #a6e358`, `background: #0a1420`, `secondary-container: #aa1400`, `surface-container-*`, `on-*`, `tertiary`, `outline`, …).
- **borderRadius:** `DEFAULT/lg/xl = 0px`, `full = 9999px`.
- **spacing:** `space-2xs … space-3xl`, `margin-mobile/desktop`, `gutter-mobile/desktop`.
- **fontFamily:** `display-hero`/`headline-*` → Space Grotesk; `body-*`/`label-caps`/`code-badge` → JetBrains Mono.
- **fontSize:** `display-hero (64px)`, `headline-lg/md/sm`, `body-lg/md/sm`, `label-caps`, `code-badge` (con su `lineHeight`, `letterSpacing` y `fontWeight`).

Además:

- `darkMode: "class"` y `<html class="dark">` en el layout.
- Fuentes con `next/font/google` (Space Grotesk 700, JetBrains Mono 400/700) en vez de `<link>`.
- Material Symbols Outlined: `<link>` en el layout (los HTML usan `<span class="material-symbols-outlined">` en varios lugares).
- CSS global: `.bg-dot-matrix` (radial-gradient `#1E354D`, 24px), `::-webkit-scrollbar { display: none }`, `overscroll-behavior: none`.

> Si se usa Tailwind v4, el config se traduce a `@theme` en el CSS. Recomendación: **v3** para copiar el bloque tal cual y no perder tiempo.

### 1.3 Layout compartido

Header fijo (`h-20`, `border-b-4 border-primary`, logo CINSOFT) y footer son idénticos en las 3 páginas → componentes `<SiteHeader />` y `<SiteFooter />` en `app/layout.tsx`. Ojo: en `/dashboard` el header muestra el usuario autenticado; en `/registro` y `/login` se queda genérico.

---

## 2. Modelo de datos (Convex)

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

### 3.1 `convex/workshops.ts`

- `list` (query, pública): talleres activos con `name`, `keyword`, `slug`, `capacity`, `enrolled`, `remaining = capacity - enrolled`, `isFull`. Alimenta el `<select>` del formulario, que debe imprimir `NOMBRE (N cupos disp.)` y marcar `disabled` los llenos.
- `stats` (query, protegida): totales para las 4 tarjetas del dashboard — total registrados, talleres activos y cuántos con cupo abierto, taller más solicitado (+ % de ocupación), cupos disponibles globales y % restante.

### 3.2 `convex/registrations.ts`

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

**`remove` (mutation protegida)** — el botón `[BORRAR]` de la tabla: borra el registro y decrementa `enrolled`.

**`exportCsv`** — se genera en el cliente desde los datos ya cargados (Blob + `URL.createObjectURL`). El HTML ya tiene el botón y su animación de "GENERANDO STREAM… / DESCARGA LISTA [OK]"; se conserva y solo se le cuelga la descarga real.

### 3.3 Guard de autorización

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

Mismo patrón para sembrar los talleres:

```bash
pnpm convex run seed:seedWorkshops
```

### 4.3 Protección de `/dashboard`

- `middleware.ts`: si no hay sesión → redirect a `/login`; si hay sesión y visita `/login` → redirect a `/dashboard`.
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
5. **Tabla** — barra de ventana tipo terminal + columnas `# · NÚMERO DE CUENTA · NOMBRE · CORREO · TALLER · GRUPO · ACCIONES`. Filas alternan `surface-container-low` / `surface-container-lowest`. El badge del taller usa `keyword` y el color de `accent`. Acciones `[VER]` (modal con la ficha completa) y `[BORRAR]` (confirmación antes de la mutation).
6. **Paginación + export** — 7 registros por página como en el HTML, texto `MOSTRANDO 1-7 DE N // PÁGINA 1 DE M`, y `EXPORTAR CSV` real (respetando el filtro/búsqueda activos).
7. **Estado vacío** — no viene en el HTML; hay que diseñarlo en el mismo lenguaje (`NO_RECORDS_FOUND // BUFFER VACÍO`).

Todo es reactivo: al llegar un registro nuevo desde `/registro`, `useQuery` actualiza tabla y métricas solo.

---

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
| **F0** | Proyecto, Tailwind con el theme portado, fuentes, layout con header/footer | — |
| **F1** | Schema Convex + seed de talleres + queries/mutations de registro | — |
| **F2** | `/registro` completo (UI + validación + mutation + estados de error) | `form.html` ✅ |
| **F3** | Better Auth + seed de admin por CLI + `/login` + middleware | `login.html` ✅ |
| **F4** | `/dashboard`: tabla, tabs, buscador, paginación | `dashboard.html` ✅ |
| **F5** | Métricas, `[VER]`, `[BORRAR]`, export CSV | F4 |
| **F6** | Motion, estados vacíos/carga, responsive, deploy | F2–F5 |

Deploy: Vercel + `pnpm convex deploy`. Variables: `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `BETTER_AUTH_SECRET`, `SITE_URL`.

---

## 8. Decisiones pendientes

1. **Correo de confirmación** — ¿se implementa (Resend + action de Convex) o se ajusta el texto del banner? El HTML promete comprobante por correo.
2. **Catálogo real de talleres** — nombre, keyword y cupo exacto de cada uno. El HTML trae 5 de ejemplo (Python 35, Ciberseguridad 12, Web 8, IA 2, BD 24) pero mencionaste cupos de 15/20/25.
3. **Grupos** — ¿el catálogo fijo del HTML (101, 102, 301, 302, 501, 502, 701, 702) es el definitivo? En la tabla del dashboard aparecen como `G-401`, `G-601`, `G-801`, que no coinciden con ese catálogo. Hay que unificar.
4. **Cierre de registros** — ¿un switch global para cerrar la convocatoria en cierta fecha?
5. **Edición de registros** — hoy solo hay `[VER]` y `[BORRAR]`. ¿Se necesita mover a un alumno de taller?
6. **Rate limiting** — la mutation de registro es pública. Con el filtro de dominio `@uaeh.edu.mx` + unicidad por cuenta el riesgo es bajo, pero conviene un límite por IP si se expone abierto.
