import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

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
