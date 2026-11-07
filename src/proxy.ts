import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { storeIngress, privateStoreHeaders } from "@/lib/server/store-ingress";

/**
 * Proxy (antes "middleware" — renombrado en Next 16).
 * Chequeo optimista de sesión para /admin y /api/admin. La autorización
 * definitiva la repiten los handlers con requireAdmin() (defensa en capas).
 */

const SESSION_COOKIE = "vlp_session";

async function getRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const ingress = await storeIngress(req);
  if (ingress.response) return ingress.response;
  const privateResponse = (response: NextResponse) => {
    Object.entries(privateStoreHeaders).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  };
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  if (pathname !== "/admin" && !pathname.startsWith("/admin/") && pathname !== "/api/admin" && !pathname.startsWith("/api/admin/")) {
    return privateResponse(NextResponse.next());
  }
  const role = await getRole(req);

  if (!role) {
    if (isApi) {
      return privateResponse(NextResponse.json(
        { ok: false, error: "Inicia sesión para continuar" },
        { status: 401 },
      ));
    }
    const url = new URL("/login", ingress.context.origin);
    url.searchParams.set("next", pathname);
    return privateResponse(NextResponse.redirect(url));
  }

  if (role !== "ADMIN") {
    if (isApi) {
      return privateResponse(NextResponse.json(
        { ok: false, error: "Solo administradores" },
        { status: 403 },
      ));
    }
    return privateResponse(NextResponse.redirect(new URL("/", ingress.context.origin)));
  }

  return privateResponse(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/webpack-hmr).*)"],
};
