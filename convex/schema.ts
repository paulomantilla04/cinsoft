import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workshops: defineTable({
    // Nombre largo: es lo que se ve en el <select> del formulario.
    name: v.string(),
    // Keyword corta: es lo que se ve en el badge de la tabla del dashboard.
    keyword: v.string(),
    // Doble uso: value del <option> y data-filter de los tabs del dashboard.
    slug: v.string(),
    capacity: v.number(),
    // Contador denormalizado: evita contar filas en cada render de métricas.
    enrolled: v.number(),
    accent: v.union(
      v.literal("primary"),
      v.literal("secondary"),
      v.literal("tertiary"),
    ),
    active: v.boolean(),
    order: v.number(),
  }).index("by_slug", ["slug"]),

  registrations: defineTable({
    // String, no number: un número de cuenta puede empezar con 0.
    accountNumber: v.string(),
    // Siempre normalizado a minúsculas antes de insertar.
    email: v.string(),
    fullName: v.string(),
    group: v.string(),
    workshopId: v.id("workshops"),
    // Sólo presente si el admin reasignó al alumno. `/estatus` lo muestra para
    // que el alumno entienda por qué su taller cambió sin que nadie le avisara.
    reassignedAt: v.optional(v.number()),
    // Constancia de que se aceptó el aviso de privacidad. La marca la pone el
    // servidor, no el cliente, para que sea prueba y no un dato declarado.
    acceptedPrivacyAt: v.optional(v.number()),
    // Consentimiento para las finalidades secundarias del aviso (fotos en
    // redes, material promocional, invitaciones). El §3.2 dice que negarse no
    // impide participar, así que va aparte del consentimiento principal.
    allowsSecondaryUse: v.optional(v.boolean()),
  })
    .index("by_account", ["accountNumber"])
    .index("by_email", ["email"])
    .index("by_workshop", ["workshopId"]),
});
