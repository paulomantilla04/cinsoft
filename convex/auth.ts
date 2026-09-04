import { betterAuth } from "better-auth";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

/**
 * Sólo correo y contraseña, y **sin registro público**: los administradores se
 * siembran por CLI (`seed:createAdmin`). `disableSignUp` bloquea el endpoint de
 * signup, así que nadie puede darse de alta desde fuera.
 */
export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    // Es la URL de la app Next: las peticiones entran por /api/auth/* y el
    // handler las reenvía al deployment de Convex. Sin esto, Better Auth
    // deduce el origen de cada request y los callbacks pueden fallar.
    baseURL: process.env.SITE_URL,
    trustedOrigins: [process.env.SITE_URL!],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    plugins: [convex({ authConfig })],
  });
