import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Guard de autorización para todo lo que toca datos de alumnos.
 *
 * Proteger las rutas en Next NO basta: las queries de Convex son accesibles
 * desde fuera de la app. Este guard es la frontera real.
 *
 * F3 lo refinará para usar el helper del componente de Better Auth; por ahora
 * exige una identidad autenticada, que es lo que ese componente provee.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "SESIÓN NO AUTORIZADA",
    });
  }
  return identity;
}
