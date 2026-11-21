import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ApiError } from "./api-helpers";
import { prisma, getStoreContext } from "@/lib/prisma";
import { publicStoreRole } from "./memberships";

export const SESSION_COOKIE = "vlp_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CUSTOMER";
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new ApiError(503, "Las sesiones no están configuradas");
  return new TextEncoder().encode(value);
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

async function storeIdentity(userId: string) {
  const { id: storeId } = await getStoreContext();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { where: { storeId, active: true }, take: 1 } },
  });
  const membership = user?.memberships[0];
  if (!user || user.status !== "ACTIVE" || !membership) return null;
  return {
    user: { id: user.id, name: user.name, email: user.email, role: publicStoreRole(membership.role) },
    version: user.sessionVersion,
  };
}

/** El DTO conserva role; su valor siempre procede de la membresía de esta tienda. */
export async function createSession(identity: Pick<SessionUser, "id"> & Partial<Omit<SessionUser, "id">>): Promise<SessionUser> {
  const current = await storeIdentity(identity.id);
  if (!current) throw new ApiError(403, "No tienes acceso activo a esta tienda");
  const token = await new SignJWT({ ...current.user, sv: current.version })
    .setProtectedHeader({ alg: "HS256" }).setSubject(current.user.id).setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`).sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true",
    path: "/", maxAge: MAX_AGE,
  });
  return current.user;
}

/** También sirve al proxy: no lee cookies de Next ni acepta una tienda del cliente. */
export async function getSessionFromToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  let id: string, version: number;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"], requiredClaims: ["sub", "iat", "exp"], maxTokenAge: `${MAX_AGE}s`,
    });
    if (!payload.sub || payload.sub.length > 191) return null;
    id = payload.sub;
    version = payload.sv === undefined ? 0 : payload.sv as number;
    if (!Number.isSafeInteger(version) || version < 0) return null;
  } catch { return null; }
  const current = await storeIdentity(id);
  return current?.version === version ? current.user : null;
}

export async function getSession(): Promise<SessionUser | null> {
  await getStoreContext();
  return getSessionFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new ApiError(401, "Inicia sesión para continuar");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "Solo administradores");
  return user;
}
