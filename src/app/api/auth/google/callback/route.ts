import { cookies } from "next/headers";
import { withErrorHandling, ApiError } from "@/lib/server/api-helpers";
import { createSession, getSession, SESSION_COOKIE } from "@/lib/server/auth";
import { consumeGoogleFlow, googleCookieName, exchangeGoogleCode, resolveGoogleAccount } from "@/lib/server/google";
import { mergeGuestCart } from "@/lib/server/carts";
import { getStoreContext } from "@/lib/prisma";

export const GET = withErrorHandling(async (request: Request) => {
  const store = await getStoreContext();
  const jar = await cookies();
  const query = new URL(request.url).searchParams;
  const name = googleCookieName(store.id);
  const flow = await consumeGoogleFlow(query.get("state"), jar.get(name)?.value, jar.get(SESSION_COOKIE)?.value);
  jar.set(name, "", { path: "/api/auth/google", maxAge: 0, httpOnly: true, sameSite: "lax", secure: store.origin.startsWith("https:") });
  if (query.has("error")) throw new ApiError(400, "Google no autorizó el acceso");
  const code = query.get("code");
  if (!code || code.length > 4096) throw new ApiError(400, "Falta un código válido de Google");
  const identity = await exchangeGoogleCode(code, flow);
  const user = await resolveGoogleAccount(identity, flow, flow.mode === "link" ? await getSession() : null);
  await createSession(user);
  await mergeGuestCart(user.id);
  return Response.redirect(`${store.origin}${flow.next}`, 303);
});
