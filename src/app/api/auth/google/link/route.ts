import { cookies } from "next/headers";
import { z } from "zod";
import { withErrorHandling, parseBody, ApiError } from "@/lib/server/api-helpers";
import { requireUser, verifyPassword, SESSION_COOKIE } from "@/lib/server/auth";
import { googleConfiguration, createGoogleFlow, googleAuthorizationUrl } from "@/lib/server/google";
import { prisma, getStoreContext } from "@/lib/prisma";
import { rateLimit } from "@/lib/server/rate-limit";

export const POST = withErrorHandling(async (request: Request) => {
  const session = await requireUser();
  const store = await getStoreContext();
  if (request.headers.get("origin") !== store.origin) throw new ApiError(403, "Origen de vinculación inválido");
  if (!rateLimit(`google:link:${session.id}`, 5, 15 * 60 * 1000).ok) throw new ApiError(429, "Demasiados intentos de vinculación");
  const body = await parseBody(request, z.object({ currentPassword: z.string().min(1), next: z.string().optional() }));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  if (!user.passwordHash || !(await verifyPassword(body.currentPassword, user.passwordHash))) throw new ApiError(403, "Confirma tu contraseña actual para vincular Google");
  googleConfiguration();
  const jar = await cookies();
  const result = await createGoogleFlow({ next: body.next ?? "/cuenta", link: { userId: user.id, version: user.sessionVersion, sessionToken: jar.get(SESSION_COOKIE)!.value } });
  const authorizationUrl = googleAuthorizationUrl(result.flow);
  jar.set(result.name, result.cookie, result.options);
  return Response.json({ ok: true, data: { authorizationUrl } });
});
