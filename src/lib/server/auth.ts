import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ApiError } from "./api-helpers";
import { getStoreContext } from "@/lib/prisma";

export const SESSION_COOKIE = "vlp_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CUSTOMER";
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Falta SESSION_SECRET en .env");
  return new TextEncoder().encode(s);
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Firma el JWT y lo deja en la cookie httpOnly. Solo en route handlers. */
export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Actívalo con COOKIE_SECURE="true" al desplegar detrás de HTTPS.
    // (NODE_ENV no sirve aquí: `next start` local también es "production".)
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Usuario de la sesión actual, o null. Seguro de llamar desde RSC. */
export async function getSession(): Promise<SessionUser | null> {
  await getStoreContext();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      name: (payload.name as string) ?? "",
      email: (payload.email as string) ?? "",
      role: payload.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Lanza 401 si no hay sesión (los handlers lo traducen vía withErrorHandling). */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Inicia sesión para continuar");
  return session;
}

/** Lanza 401/403 si no hay sesión de administrador. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireUser();
  if (session.role !== "ADMIN")
    throw new ApiError(403, "Solo administradores");
  return session;
}
