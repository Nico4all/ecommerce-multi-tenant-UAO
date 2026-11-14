import { cookies } from "next/headers";
import { withErrorHandling, ApiError } from "@/lib/server/api-helpers";
import { googleConfiguration, createGoogleFlow, googleAuthorizationUrl } from "@/lib/server/google";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { getStoreContext } from "@/lib/prisma";

export const GET = withErrorHandling(async (request: Request) => {
  googleConfiguration();
  const store = await getStoreContext();
  if (!rateLimit(`google:start:${store.id}:${clientIp(request)}`, 10, 15 * 60 * 1000).ok) throw new ApiError(429, "Demasiados intentos de acceso");
  const query = new URL(request.url).searchParams;
  const result = await createGoogleFlow({ next: query.get("next"), acceptedTerms: query.get("acceptedTerms") === "true" });
  const authorization = googleAuthorizationUrl(result.flow);
  (await cookies()).set(result.name, result.cookie, result.options);
  return Response.redirect(authorization, 302);
});
