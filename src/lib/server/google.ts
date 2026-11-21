import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { EncryptJWT, jwtDecrypt, jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { prisma, getStoreContext } from "@/lib/prisma";
import { ApiError } from "./api-helpers";
import { ensureCustomerMembership } from "./memberships";
import type { SessionUser } from "./auth";

const AUTHORIZATION = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const TTL = 600;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const same = (a: string, b: string) => {
  const first = Buffer.from(a), second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
};
const random = () => randomBytes(32).toString("base64url");
const flowSchema = z.object({
  state: z.string().min(40).max(100), nonce: z.string().min(40).max(100), verifier: z.string().min(43).max(128),
  storeId: z.string(), origin: z.string(), next: z.string(), acceptedTerms: z.boolean(),
  mode: z.enum(["login", "link"]), userId: z.string().optional(), version: z.number().int().optional(), sessionHash: z.string().optional(),
});
export type GoogleFlow = z.infer<typeof flowSchema>;
export interface GoogleIdentity { subject: string; email: string; name: string }

export function googleConfiguration() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new ApiError(503, "El acceso con Google no está configurado");
  return { clientId, clientSecret };
}
function encryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new ApiError(503, "Las sesiones no están configuradas");
  return createHash("sha256").update(secret).digest();
}
export const googleCookieName = (storeId: string) => `vlp_google_${hash(storeId).slice(0, 24)}`;

/** Rutas de retorno locales explícitas; no URLs, query strings ni escapes ambiguos. */
export function googleNextPath(value?: string | null): string {
  const next = value || "/";
  if (/[\x00-\x20\x7f%\\]/u.test(next)) throw new ApiError(400, "Destino de acceso no permitido");
  if (["/", "/cuenta", "/cart", "/wishlist", "/checkout", "/orders"].includes(next) ||
    /^\/(?:orders|admin)(?:\/[a-zA-Z0-9_-]+)*$/.test(next)) return next;
  throw new ApiError(400, "Destino de acceso no permitido");
}

/** Estado cifrado ligado al navegador y tienda; el hash en DB evita replay concurrente. */
export async function createGoogleFlow(input: {
  next?: string | null; acceptedTerms?: boolean;
  link?: { userId: string; version: number; sessionToken: string };
}) {
  const store = await getStoreContext();
  const flow: GoogleFlow = {
    state: random(), nonce: random(), verifier: randomBytes(48).toString("base64url"),
    storeId: store.id, origin: store.origin, next: googleNextPath(input.next),
    acceptedTerms: input.acceptedTerms === true, mode: input.link ? "link" : "login",
    ...(input.link ? { userId: input.link.userId, version: input.link.version, sessionHash: hash(input.link.sessionToken) } : {}),
  };
  const cookie = await new EncryptJWT(flow).setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuer("google-oauth-flow").setAudience(store.id).setIssuedAt().setExpirationTime(`${TTL}s`).encrypt(encryptionKey());
  await prisma.oAuthAttempt.create({ data: { storeId: store.id, stateHash: hash(flow.state), userId: flow.userId, expiresAt: new Date(Date.now() + TTL * 1000) } });
  return { flow, cookie, name: googleCookieName(store.id), options: { httpOnly: true, sameSite: "lax" as const, secure: store.origin.startsWith("https:"), path: "/api/auth/google", maxAge: TTL } };
}

export async function consumeGoogleFlow(state: string | null, cookie?: string, sessionToken?: string): Promise<GoogleFlow> {
  const store = await getStoreContext();
  const invalid = () => new ApiError(400, "El acceso con Google venció o no corresponde a esta solicitud");
  if (!state || !cookie) throw invalid();
  let flow: GoogleFlow;
  try {
    const result = await jwtDecrypt(cookie, encryptionKey(), {
      issuer: "google-oauth-flow", audience: store.id, keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"],
      requiredClaims: ["iat", "exp"], maxTokenAge: `${TTL}s`,
    });
    flow = flowSchema.parse(result.payload);
  } catch { throw invalid(); }
  if (flow.storeId !== store.id || flow.origin !== store.origin || !same(flow.state, state) ||
    googleNextPath(flow.next) !== flow.next || (flow.mode === "link" && (!sessionToken || !flow.sessionHash || !same(hash(sessionToken), flow.sessionHash)))) throw invalid();
  const claimed = await prisma.oAuthAttempt.updateMany({
    where: { stateHash: hash(state), storeId: store.id, userId: flow.userId ?? null, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) throw invalid();
  return flow;
}

export function googleAuthorizationUrl(flow: GoogleFlow) {
  const { clientId } = googleConfiguration();
  const params = new URLSearchParams({
    client_id: clientId, response_type: "code", scope: "openid email profile",
    redirect_uri: `${flow.origin}/api/auth/google/callback`, state: flow.state, nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"), code_challenge_method: "S256", prompt: "select_account",
  });
  return `${AUTHORIZATION}?${params}`;
}

/** Firma RS256 y claims de identidad comprobados; email nunca sustituye al sub. */
export async function verifyGoogleIdToken(token: string, nonce: string, clientId: string, keySet: JWTVerifyGetKey = keys): Promise<GoogleIdentity> {
  try {
    const { payload } = await jwtVerify(token, keySet, {
      issuer: ["https://accounts.google.com", "accounts.google.com"], audience: clientId, algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp", "nonce", "email", "email_verified"], maxTokenAge: "10m", clockTolerance: 5,
    });
    if (!payload.sub || !/^[\x21-\x7e]{1,255}$/.test(payload.sub) || typeof payload.nonce !== "string" || !same(payload.nonce, nonce) ||
      payload.email_verified !== true || typeof payload.email !== "string" || !z.email().safeParse(payload.email).success ||
      (payload.azp !== undefined && payload.azp !== clientId) || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId)) throw new Error("Claims inválidos");
    return { subject: payload.sub, email: payload.email.trim().toLowerCase(), name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 191) : payload.email.split("@")[0] };
  } catch { throw new ApiError(401, "No se pudo verificar la identidad de Google"); }
}

export async function exchangeGoogleCode(code: string, flow: GoogleFlow): Promise<GoogleIdentity> {
  const { clientId, clientSecret } = googleConfiguration();
  let token: unknown;
  try {
    const response = await fetch(TOKEN, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: `${flow.origin}/api/auth/google/callback`, code_verifier: flow.verifier }),
    });
    if (!response.ok) throw new Error("Intercambio rechazado");
    const data = await response.json(); token = data?.id_token;
  } catch { throw new ApiError(502, "Google no pudo completar el acceso. Inicia el flujo de nuevo."); }
  if (typeof token !== "string") throw new ApiError(401, "Google no devolvió una identidad válida");
  return verifyGoogleIdToken(token, flow.nonce, clientId);
}

/** Política explícita: nunca vincular por coincidencia de correo sin reautenticación. */
export async function resolveGoogleAccount(identity: GoogleIdentity, flow: GoogleFlow, session: SessionUser | null) {
  const { id: storeId } = await getStoreContext();
  if (storeId !== flow.storeId) throw new ApiError(400, "Tienda de acceso inválida");
  return prisma.$transaction(async (tx) => {
    let user;
    if (flow.mode === "link") {
      if (!session || session.id !== flow.userId) throw new ApiError(401, "Vuelve a iniciar sesión antes de vincular Google");
      user = await tx.user.findUnique({ where: { id: session.id, status: "ACTIVE", sessionVersion: flow.version } });
      if (!user || !user.passwordHash || user.email.toLowerCase() !== identity.email || (user.googleId && user.googleId !== identity.subject)) throw new ApiError(409, "Esta identidad de Google no se puede vincular a tu cuenta");
      const linked = await tx.user.updateMany({
        where: { id: user.id, googleId: user.googleId, sessionVersion: flow.version }, data: { googleId: identity.subject, sessionVersion: { increment: 1 } },
      });
      if (linked.count !== 1) throw new ApiError(409, "Tu cuenta cambió durante la vinculación");
    } else {
      user = await tx.user.findUnique({ where: { googleId: identity.subject } });
      if (user && user.googleId !== identity.subject) throw new ApiError(409, "Identidad de Google no coincidente");
      if (!user) {
        if (await tx.user.findUnique({ where: { email: identity.email } })) throw new ApiError(409, "Ya existe esa cuenta. Inicia sesión con contraseña y vincula Google desde tu cuenta.");
        if (!flow.acceptedTerms) throw new ApiError(400, "Debes aceptar los Términos y la Política de datos personales");
        user = await tx.user.create({ data: { name: identity.name, email: identity.email, googleId: identity.subject, role: "CUSTOMER", termsAcceptedAt: new Date() } });
      }
      if (user.status !== "ACTIVE") throw new ApiError(403, "Tu cuenta está desactivada");
    }
    await ensureCustomerMembership(user.id, tx);
    return user;
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ApiError(409, "Esta identidad ya está asociada a otra cuenta");
    throw error;
  });
}
