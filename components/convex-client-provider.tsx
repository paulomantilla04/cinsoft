"use client";

import { ConvexReactClient } from "convex/react";
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

// Sin `expectAuth`: con esa opción el cliente espera a que haya sesión antes
// de lanzar ninguna query, y /registro y /estatus son públicas — el catálogo
// de talleres se quedaba en "CARGANDO CATÁLOGO..." para siempre.
// El dashboard no lo necesita: lo protegen `proxy.ts`, `requireAdmin` y el
// skip por `isAuthenticated` de sus propias queries.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    // El cast aísla un defecto de tipos del componente: su tipo `AuthClient`
    // resuelve `useSession().data` a `never`, así que ningún cliente real
    // encaja. El tipo inferido de `authClient` es el correcto y se conserva
    // intacto para el resto de la app; en runtime son el mismo objeto.
    <ConvexBetterAuthProvider
      authClient={authClient as unknown as AuthClient}
      client={convex}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
