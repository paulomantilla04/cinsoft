import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { applyMove } from "./lib/registrations";
import { parseLookupTerm, registrationSchema } from "../lib/validation";
import { assertCanJoin } from "./lib/registrations";

/**
 * El corazón de la app. Pública.
 *
 * Las mutations de Convex son transaccionales y serializables, así que leer el
 * cupo e insertar dentro de la misma mutation es atómico: no hace falta lock ni
 * retry. Por eso el cupo NO se puede validar solo en el cliente.
 */
export const create = mutation({
  args: {
    accountNumber: v.string(),
    email: v.string(),
    fullName: v.string(),
    group: v.string(),
    workshopId: v.id("workshops"),
    acceptedPrivacy: v.boolean(),
    allowsSecondaryUse: v.boolean(),
  },
  handler: async (ctx, args) => {
    // 0. El consentimiento se comprueba en el servidor: que la UI no deje
    // enviar sin aceptar es comodidad, no garantía.
    if (!args.acceptedPrivacy) {
      throw new ConvexError({
        code: "PRIVACY_NOT_ACCEPTED",
        message: "Debes aceptar el aviso de privacidad para registrarte.",
      });
    }

    // 1 y 2. Normalizar y validar con el mismo esquema que usa el cliente.
    const parsed = registrationSchema.safeParse(args);
    if (!parsed.success) {
      throw new ConvexError({
        code: "VALIDATION",
        message: parsed.error.issues[0].message,
      });
    }
    const { accountNumber, email, fullName, group } = parsed.data;

    const workshop = await ctx.db.get(args.workshopId);
    if (workshop === null || !workshop.active) {
      throw new ConvexError({
        code: "WORKSHOP_NOT_FOUND",
        message: "El taller seleccionado ya no está disponible.",
      });
    }

    // 3. Inscripciones que ya tiene este alumno. Cada inscripción es una fila
    // propia, así que buscar por cuenta devuelve una o dos.
    const byAccount = await ctx.db
      .query("registrations")
      .withIndex("by_account", (q) => q.eq("accountNumber", accountNumber))
      .collect();
    const byEmail = await ctx.db
      .query("registrations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    // La cuenta y el correo tienen que apuntar al mismo alumno; si no, alguien
    // se está registrando con la cuenta de otro o con un correo distinto al
    // que ya usó, y acabaríamos con dos identidades cruzadas.
    const mismatch =
      byAccount.some((row) => row.email !== email) ||
      byEmail.some((row) => row.accountNumber !== accountNumber);
    if (mismatch) {
      throw new ConvexError({
        code: "IDENTITY_MISMATCH",
        message:
          "Ese número de cuenta ya está registrado con otro correo. Usa el mismo con el que te inscribiste.",
      });
    }

    await assertCanJoin(ctx, byAccount, workshop);

    // 5. Insertar y actualizar el contador denormalizado.
    const registrationId = await ctx.db.insert("registrations", {
      accountNumber,
      email,
      fullName,
      group,
      workshopId: workshop._id,
      // La hora la fija el servidor: un cliente podría declarar cualquiera.
      acceptedPrivacyAt: Date.now(),
      allowsSecondaryUse: args.allowsSecondaryUse,
    });
    await ctx.db.patch(workshop._id, { enrolled: workshop.enrolled + 1 });

    return {
      registrationId,
      accountNumber,
      email,
      fullName,
      group,
      workshopName: workshop.name,
    };
  },
});

/**
 * Todos los registros con su taller resuelto, más reciente primero. Protegida.
 *
 * Con el volumen esperado (cientos de filas) se traen completos y se filtra y
 * pagina en el cliente: así los tabs, el buscador y los contadores funcionan
 * sin round-trips. Si crece mucho, migrar a `paginate()`.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const registrations = await ctx.db
      .query("registrations")
      .order("desc")
      .collect();

    const workshops = await ctx.db.query("workshops").collect();
    const byId = new Map(workshops.map((workshop) => [workshop._id, workshop]));

    return registrations.map((registration) => {
      const workshop = byId.get(registration.workshopId);
      return {
        _id: registration._id,
        _creationTime: registration._creationTime,
        accountNumber: registration.accountNumber,
        email: registration.email,
        fullName: registration.fullName,
        group: registration.group,
        reassignedAt: registration.reassignedAt,
        acceptedPrivacyAt: registration.acceptedPrivacyAt,
        allowsSecondaryUse: registration.allowsSecondaryUse,
        workshop: {
          keyword: workshop?.keyword ?? "—",
          slug: workshop?.slug ?? "unknown",
          accent: workshop?.accent ?? "primary",
        },
      };
    });
  },
});

/**
 * El botón [MOVER] de la tabla: reasigna a un alumno a otro taller. Protegida.
 * La lógica vive en `lib/registrations.ts`.
 */
export const move = mutation({
  args: {
    registrationId: v.id("registrations"),
    workshopId: v.id("workshops"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await applyMove(ctx, args.registrationId, args.workshopId);
  },
});

/** El botón [BORRAR] de la tabla. Protegida. */
export const remove = mutation({
  args: { registrationId: v.id("registrations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const registration = await ctx.db.get(args.registrationId);
    if (registration === null) return;

    await ctx.db.delete(registration._id);

    const workshop = await ctx.db.get(registration.workshopId);
    if (workshop !== null) {
      await ctx.db.patch(workshop._id, {
        enrolled: Math.max(0, workshop.enrolled - 1),
      });
    }
  },
});

/**
 * Enmascara el nombre dejando el primer nombre completo y las iniciales del
 * resto: "alejandro morales silva" -> "ALEJANDRO M. S."
 */
function maskName(fullName: string) {
  const [first, ...rest] = fullName.split(" ").filter(Boolean);
  if (first === undefined) return "";
  const initials = rest.map((part) => `${part[0].toUpperCase()}.`);
  return [first, ...initials].join(" ").toUpperCase();
}

/**
 * Consulta pública de estatus para /estatus: el alumno escribe su número de
 * cuenta o su correo institucional y ve en qué taller quedó.
 *
 * Sirve sobre todo para que un alumno al que el admin movió de taller pueda
 * confirmarlo por su cuenta, sin que nadie tenga que avisarle.
 *
 * Los datos personales van enmascarados a propósito: el número de cuenta son 6
 * dígitos y por tanto es enumerable, así que la respuesta debe alcanzar para
 * que el alumno se reconozca pero no para cosechar datos ajenos.
 *
 * El correo **no se devuelve en ninguna forma**, ni enmascarado. En la UAEH se
 * deriva de las dos primeras letras del primer apellido más el número de
 * cuenta, así que una máscara como `mo****21@` junto al número que la persona
 * acaba de teclear reconstruye el correo entero. Además ese correo es el
 * segundo dato que `addWorkshop` exige para confirmar identidad: revelarlo
 * dejaría inscribir talleres a nombre de cualquiera.
 */
export const lookup = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    const parsed = parseLookupTerm(args.term);
    if (parsed === null) {
      return { status: "invalid" } as const;
    }

    const found =
      parsed.kind === "account"
        ? await ctx.db
            .query("registrations")
            .withIndex("by_account", (q) => q.eq("accountNumber", parsed.value))
            .collect()
        : await ctx.db
            .query("registrations")
            .withIndex("by_email", (q) => q.eq("email", parsed.value))
            .collect();

    if (found.length === 0) {
      return { status: "not_found" } as const;
    }

    // Un alumno puede tener hasta dos talleres, así que devolvemos todos.
    const registrations = [];
    for (const registration of found.toSorted(
      (a, b) => a._creationTime - b._creationTime,
    )) {
      const workshop = await ctx.db.get(registration.workshopId);
      registrations.push({
        accountNumber: registration.accountNumber,
        maskedName: maskName(registration.fullName),
        group: registration.group,
        registeredAt: registration._creationTime,
        reassignedAt: registration.reassignedAt,
        workshop: {
          _id: registration.workshopId,
          name: workshop?.name ?? "—",
          keyword: workshop?.keyword ?? "—",
          accent: workshop?.accent ?? "primary",
          startsAt: workshop?.startsAt,
          endsAt: workshop?.endsAt,
        },
      });
    }

    return { status: "found" as const, registrations };
  },
});


/**
 * Suma un segundo taller a alguien que ya está inscrito, sin pedirle otra vez
 * sus datos. Es lo que usa /estatus.
 *
 * Exige el correo institucional además del número de cuenta: /estatus es
 * público y la cuenta son seis dígitos enumerables, así que sin esto
 * cualquiera podría inscribir a otros alumnos y llenar los talleres.
 * Consultar sigue necesitando sólo la cuenta; inscribir necesita ambos.
 */
export const addWorkshop = mutation({
  args: {
    accountNumber: v.string(),
    email: v.string(),
    workshopId: v.id("workshops"),
    acceptedPrivacy: v.boolean(),
    allowsSecondaryUse: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.acceptedPrivacy) {
      throw new ConvexError({
        code: "PRIVACY_NOT_ACCEPTED",
        message: "Debes aceptar el aviso de privacidad para registrarte.",
      });
    }

    const accountNumber = args.accountNumber.trim();
    const email = args.email.trim().toLowerCase();

    const existing = await ctx.db
      .query("registrations")
      .withIndex("by_account", (q) => q.eq("accountNumber", accountNumber))
      .collect();

    // Mensaje único para "no existe" y "el correo no coincide": distinguirlos
    // confirmaría qué números de cuenta están registrados.
    const match = existing.find((row) => row.email === email);
    if (match === undefined) {
      throw new ConvexError({
        code: "IDENTITY_MISMATCH",
        message:
          "El número de cuenta y el correo no coinciden con ningún registro.",
      });
    }

    const workshop = await ctx.db.get(args.workshopId);
    if (workshop === null || !workshop.active) {
      throw new ConvexError({
        code: "WORKSHOP_NOT_FOUND",
        message: "El taller seleccionado ya no está disponible.",
      });
    }

    await assertCanJoin(ctx, existing, workshop);

    // Nombre y grupo se copian del registro que ya existe: así el alumno no los
    // reescribe y no acaba con dos filas que se contradicen.
    const registrationId = await ctx.db.insert("registrations", {
      accountNumber: match.accountNumber,
      email: match.email,
      fullName: match.fullName,
      group: match.group,
      workshopId: workshop._id,
      acceptedPrivacyAt: Date.now(),
      allowsSecondaryUse: args.allowsSecondaryUse,
    });
    await ctx.db.patch(workshop._id, { enrolled: workshop.enrolled + 1 });

    return { registrationId, workshopName: workshop.name };
  },
});
