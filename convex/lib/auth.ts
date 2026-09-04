import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { authComponent } from "../auth";

/**
 * Guard de autorización para todo lo que toca datos de alumnos.
 *
 * Proteger las rutas en Next NO basta: las queries de Convex son accesibles
 * desde fuera de la app. Este guard es la frontera real.
 *
 * Como no hay registro público (`disableSignUp`), toda sesión válida pertenece
 * a un admin sembrado por CLI, así que basta con exigir usuario autenticado.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (user === undefined || user === null) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "SESIÓN NO AUTORIZADA",
    });
  }
  return user;
}
