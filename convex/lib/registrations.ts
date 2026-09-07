import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { MAX_WORKSHOPS_PER_STUDENT } from "../../lib/validation";
import { overlaps, toSchedule } from "../../lib/schedule";

/**
 * Reasigna un alumno de taller. Extraído de la mutation `registrations.move`
 * para poder ejercitarlo sin pasar por el guard de admin.
 *
 * Los tres pasos —bajar el contador del taller viejo, subir el del nuevo y
 * repuntar el registro— ocurren dentro de la misma mutation, así que o pasan
 * todos o no pasa ninguno.
 */
export async function applyMove(
  ctx: MutationCtx,
  registrationId: Id<"registrations">,
  workshopId: Id<"workshops">,
) {
  const registration = await ctx.db.get(registrationId);
  if (registration === null) {
    throw new ConvexError({
      code: "REGISTRATION_NOT_FOUND",
      message: "El registro ya no existe.",
    });
  }

  // Mover al taller en el que ya está no es un error, simplemente no hace
  // nada: evita que un doble click descuadre los contadores.
  if (registration.workshopId === workshopId) {
    return { moved: false as const };
  }

  const target = await ctx.db.get(workshopId);
  if (target === null || !target.active) {
    throw new ConvexError({
      code: "WORKSHOP_NOT_FOUND",
      message: "El taller destino no está disponible.",
    });
  }

  // Mover a alguien a un taller lleno lo dejaría por encima de su capacidad.
  if (target.enrolled >= target.capacity) {
    throw new ConvexError({
      code: "WORKSHOP_FULL",
      message: `${target.name} ya alcanzó su cupo máximo.`,
    });
  }

  // Un alumno puede tener otra inscripción: el destino no puede ser esa misma
  // ni cruzarse con su horario.
  const siblings = (
    await ctx.db
      .query("registrations")
      .withIndex("by_account", (q) =>
        q.eq("accountNumber", registration.accountNumber),
      )
      .collect()
  ).filter((row) => row._id !== registration._id);

  if (siblings.some((row) => row.workshopId === target._id)) {
    throw new ConvexError({
      code: "ALREADY_IN_WORKSHOP",
      message: `El alumno ya está inscrito en ${target.name}.`,
    });
  }

  const targetSchedule = toSchedule(target);
  if (targetSchedule !== null) {
    for (const row of siblings) {
      const other = await ctx.db.get(row.workshopId);
      if (other === null) continue;
      const otherSchedule = toSchedule(other);
      if (otherSchedule !== null && overlaps(targetSchedule, otherSchedule)) {
        throw new ConvexError({
          code: "SCHEDULE_CONFLICT",
          message: `${target.name} se empalma con ${other.name}, su otro taller.`,
        });
      }
    }
  }

  const origin = await ctx.db.get(registration.workshopId);

  await ctx.db.patch(registration._id, {
    workshopId: target._id,
    reassignedAt: Date.now(),
  });
  await ctx.db.patch(target._id, { enrolled: target.enrolled + 1 });
  if (origin !== null) {
    await ctx.db.patch(origin._id, {
      enrolled: Math.max(0, origin.enrolled - 1),
    });
  }

  return {
    moved: true as const,
    accountNumber: registration.accountNumber,
    from: origin?.name ?? "—",
    to: target.name,
  };
}

/**
 * Reglas que decide si un alumno puede sumar un taller más: tope de talleres,
 * no repetir, no cruzarse de horario y que quede cupo.
 *
 * Vive aquí para que la usen igual el alta desde /registro y el añadido desde
 * /estatus, y no se puedan separar por descuido.
 */
export async function assertCanJoin(
  ctx: QueryCtx | MutationCtx,
  existing: Doc<"registrations">[],
  workshop: Doc<"workshops">,
) {
  if (existing.length >= MAX_WORKSHOPS_PER_STUDENT) {
    throw new ConvexError({
      code: "MAX_WORKSHOPS",
      message: `Ya estás inscrito en ${MAX_WORKSHOPS_PER_STUDENT} talleres, que es el máximo.`,
    });
  }

  if (existing.some((row) => row.workshopId === workshop._id)) {
    throw new ConvexError({
      code: "ALREADY_IN_WORKSHOP",
      message: "Ya estás inscrito en ese taller.",
    });
  }

  const schedule = toSchedule(workshop);
  if (schedule !== null) {
    for (const row of existing) {
      const other = await ctx.db.get(row.workshopId);
      if (other === null) continue;
      const otherSchedule = toSchedule(other);
      if (otherSchedule !== null && overlaps(schedule, otherSchedule)) {
        throw new ConvexError({
          code: "SCHEDULE_CONFLICT",
          message: `Ese taller se empalma con ${other.name}, en el que ya estás inscrito.`,
        });
      }
    }
  }

  if (workshop.enrolled >= workshop.capacity) {
    throw new ConvexError({
      code: "WORKSHOP_FULL",
      message: "El taller alcanzó su cupo máximo.",
    });
  }
}
