import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import { verifyPassword, createSession } from "@/lib/server/auth";
import { mergeGuestCart } from "@/lib/server/carts";
import { ensureCustomerMembership } from "@/lib/server/memberships";
import { rateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  email: z.email("Correo inválido").trim().toLowerCase(),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, schema);
  if (!rateLimit(`login:email:${body.email}`, 10, 15 * 60 * 1000).ok) throw new ApiError(429, "Demasiados intentos de acceso. Espera unos minutos.");

  const user = await prisma.user.findUnique({ where: { email: body.email } });

  // Las cuentas de solo Google no tienen una contraseña que acertar.
  // (El registro ya revela con un 409 si un correo tiene cuenta, así que esto
  // no filtra nada nuevo.)
  if (user && !user.passwordHash) {
    throw new ApiError(
      409,
      "Esta cuenta aún no tiene contraseña. Usa “¿Olvidaste tu contraseña?” para crear una.",
    );
  }

  const valid =
    user?.passwordHash && (await verifyPassword(body.password, user.passwordHash));
  if (!user || !valid) {
    throw new ApiError(401, "Correo o contraseña incorrectos");
  }
  if (user.status === "INACTIVE") {
    throw new ApiError(403, "Tu cuenta está desactivada. Contacta a soporte.");
  }

  await ensureCustomerMembership(user.id);
  const session = await createSession(user);
  await mergeGuestCart(user.id);

  return jsonOk(session);
});
