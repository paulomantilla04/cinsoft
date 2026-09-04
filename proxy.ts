import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth-server";

/**
 * En Next 16 el antiguo `middleware.ts` se llama `proxy.ts`.
 *
 * Esto es una comprobación optimista para no pintar el dashboard a quien no ha
 * iniciado sesión. **No es la protección real**: esa vive en `requireAdmin`
 * dentro de Convex, porque las queries son accesibles sin pasar por Next.
 */
export async function proxy(request: NextRequest) {
  const authed = await isAuthenticated();
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !authed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/login") && authed) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
