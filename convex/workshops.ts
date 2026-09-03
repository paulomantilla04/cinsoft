import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

/**
 * Talleres activos con su cupo. Pública: alimenta el <select> de /registro.
 * Devuelve solo cupos — nunca nombres ni datos de otros alumnos.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const workshops = await ctx.db
      .query("workshops")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();

    return workshops
      .sort((a, b) => a.order - b.order)
      .map((workshop) => {
        const remaining = Math.max(0, workshop.capacity - workshop.enrolled);
        return {
          _id: workshop._id,
          name: workshop.name,
          keyword: workshop.keyword,
          slug: workshop.slug,
          accent: workshop.accent,
          capacity: workshop.capacity,
          enrolled: workshop.enrolled,
          remaining,
          isFull: remaining === 0,
        };
      });
  },
});

/** Métricas de las 4 tarjetas del dashboard. Protegida. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const workshops = await ctx.db.query("workshops").collect();
    const active = workshops.filter((workshop) => workshop.active);

    const totalCapacity = active.reduce((sum, w) => sum + w.capacity, 0);
    const totalEnrolled = active.reduce((sum, w) => sum + w.enrolled, 0);
    const availableSeats = Math.max(0, totalCapacity - totalEnrolled);

    // "+N en la última hora" de la tarjeta 1.
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const registrations = await ctx.db.query("registrations").collect();
    const lastHour = registrations.filter((r) => r._creationTime >= oneHourAgo);

    const topWorkshop = active.reduce<(typeof active)[number] | null>(
      (top, workshop) =>
        top === null || workshop.enrolled > top.enrolled ? workshop : top,
      null,
    );

    return {
      totalRegistrations: registrations.length,
      registrationsLastHour: lastHour.length,
      activeWorkshops: active.length,
      workshopsWithSeats: active.filter((w) => w.enrolled < w.capacity).length,
      topWorkshop:
        topWorkshop === null
          ? null
          : {
              keyword: topWorkshop.keyword,
              enrolled: topWorkshop.enrolled,
              occupancyPercent:
                topWorkshop.capacity === 0
                  ? 0
                  : Math.round(
                      (topWorkshop.enrolled / topWorkshop.capacity) * 100,
                    ),
            },
      availableSeats,
      totalCapacity,
      occupancyPercent:
        totalCapacity === 0
          ? 0
          : Math.round((totalEnrolled / totalCapacity) * 100),
      availablePercent:
        totalCapacity === 0
          ? 0
          : Math.round((availableSeats / totalCapacity) * 100),
    };
  },
});
