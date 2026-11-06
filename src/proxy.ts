import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

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
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const role = await getRole(req);

  if (!role) {
    if (isApi) {
      return NextResponse.json(
        { ok: false, error: "Inicia sesión para continuar" },
        { status: 401 },
      );
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (role !== "ADMIN") {
    if (isApi) {
      return NextResponse.json(
        { ok: false, error: "Solo administradores" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
