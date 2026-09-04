"use client";

import { ConvexReactClient } from "convex/react";
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  expectAuth: true,
});

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
