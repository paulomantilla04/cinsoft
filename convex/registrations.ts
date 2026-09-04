import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { applyMove } from "./lib/registrations";
import { parseLookupTerm, registrationSchema } from "../lib/validation";

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

    // 3. Duplicados: un alumno = un solo taller.
    const byAccount = await ctx.db
      .query("registrations")
      .withIndex("by_account", (q) => q.eq("accountNumber", accountNumber))
      .first();
    if (byAccount !== null) {
      throw new ConvexError({
        code: "DUPLICATE_ACCOUNT",
        message: "Ese número de cuenta ya tiene un taller asignado.",
      });
    }

    const byEmail = await ctx.db
      .query("registrations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (byEmail !== null) {
      throw new ConvexError({
        code: "DUPLICATE_EMAIL",
        message: "Ese correo ya tiene un taller asignado.",
      });
    }

    // 4. Cupo.
    if (workshop.enrolled >= workshop.capacity) {
      throw new ConvexError({
        code: "WORKSHOP_FULL",
        message: "El taller alcanzó su cupo máximo.",
      });
    }

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

/** "mo123456@uaeh.edu.mx" -> "mo****56@uaeh.edu.mx" */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (domain === undefined) return email;
  if (local.length <= 4) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(local.length - 4)}${local.slice(-2)}@${domain}`;
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
 * que el alumno se reconozca pero no para cosechar nombres y correos ajenos.
 */
export const lookup = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    const parsed = parseLookupTerm(args.term);
    if (parsed === null) {
      return { status: "invalid" } as const;
    }

    const registration =
      parsed.kind === "account"
        ? await ctx.db
            .query("registrations")
            .withIndex("by_account", (q) => q.eq("accountNumber", parsed.value))
            .first()
        : await ctx.db
            .query("registrations")
            .withIndex("by_email", (q) => q.eq("email", parsed.value))
            .first();

    if (registration === null) {
      return { status: "not_found" } as const;
    }

    const workshop = await ctx.db.get(registration.workshopId);

    return {
      status: "found" as const,
      registration: {
        accountNumber: registration.accountNumber,
        maskedName: maskName(registration.fullName),
        maskedEmail: maskEmail(registration.email),
        group: registration.group,
        registeredAt: registration._creationTime,
        reassignedAt: registration.reassignedAt,
        acceptedPrivacyAt: registration.acceptedPrivacyAt,
        allowsSecondaryUse: registration.allowsSecondaryUse,
        workshop: {
          name: workshop?.name ?? "—",
          keyword: workshop?.keyword ?? "—",
          accent: workshop?.accent ?? "primary",
        },
      },
    };
  },
});
