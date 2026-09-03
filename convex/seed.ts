import { internalMutation } from "./_generated/server";

/**
 * Catálogo FICTICIO de arranque (PLAN §8.2). Sustituir por el real en cuanto
 * lleguen nombre, keyword y cupo definitivos de cada taller: basta editar esta
 * lista y volver a correr `pnpm convex run seed:seedWorkshops`.
 *
 * `keyword` es lo que se ve en el badge de la tabla; `name`, lo que se ve en el
 * <select> del formulario; `slug`, el data-filter de los tabs del dashboard.
 */
const WORKSHOPS = [
  {
    name: "Introducción a Python",
    keyword: "PYTHON AVANZADO",
    slug: "python",
    capacity: 25,
    accent: "tertiary" as const,
  },
  {
    name: "Ciberseguridad Básica",
    keyword: "CIBERSEGURIDAD",
    slug: "security",
    capacity: 20,
    accent: "secondary" as const,
  },
  {
    name: "Desarrollo Web",
    keyword: "DESARROLLO WEB",
    slug: "web",
    capacity: 20,
    accent: "primary" as const,
  },
  {
    name: "Inteligencia Artificial & LLMs",
    keyword: "IA & LLMS",
    slug: "ia",
    capacity: 15,
    accent: "primary" as const,
  },
  {
    name: "Bases de Datos",
    keyword: "BASES DE DATOS",
    slug: "db",
    capacity: 25,
    accent: "tertiary" as const,
  },
];

/**
 * Idempotente: actualiza los talleres que ya existen (por slug) y crea los que
 * falten. Nunca toca `enrolled`, así que se puede re-correr sin perder cupos
 * ya asignados.
 */
export const seedWorkshops = internalMutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    let updated = 0;

    for (const [index, workshop] of WORKSHOPS.entries()) {
      const existing = await ctx.db
        .query("workshops")
        .withIndex("by_slug", (q) => q.eq("slug", workshop.slug))
        .first();

      if (existing === null) {
        await ctx.db.insert("workshops", {
          ...workshop,
          enrolled: 0,
          active: true,
          order: index,
        });
        created += 1;
      } else {
        await ctx.db.patch(existing._id, {
          name: workshop.name,
          keyword: workshop.keyword,
          capacity: workshop.capacity,
          accent: workshop.accent,
          active: true,
          order: index,
        });
        updated += 1;
      }
    }

    return { created, updated };
  },
});

/**
 * Solo desarrollo: borra todos los registros y pone `enrolled` en 0.
 * `internalMutation`, así que no es invocable desde el cliente.
 *
 *     pnpm convex run seed:resetRegistrations
 */
export const resetRegistrations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const registrations = await ctx.db.query("registrations").collect();
    for (const registration of registrations) {
      await ctx.db.delete(registration._id);
    }

    const workshops = await ctx.db.query("workshops").collect();
    for (const workshop of workshops) {
      await ctx.db.patch(workshop._id, { enrolled: 0 });
    }

    return { deleted: registrations.length };
  },
});
