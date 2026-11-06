import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import { resetPassword } from "@/lib/server/password-reset";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";

const schema = z.object({
  token: z.string().min(1, "Falta el token"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

/** Fija la nueva contraseña a partir del token del enlace. */
export const POST = withErrorHandling(async (req: Request) => {
  // Los tokens son de 256 bits (imposibles de adivinar), pero se limita por IP
  // para cortar cualquier martilleo del endpoint.
  const { ok } = rateLimit(`reset:ip:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!ok) {
    throw new ApiError(429, "Demasiados intentos. Espera unos minutos.");
  }

  const { token, password } = await parseBody(req, schema);
  await resetPassword(token, password);
  return jsonOk({ message: "Tu contraseña se actualizó. Ya puedes iniciar sesión." });
});
