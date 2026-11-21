import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import { requireUser, createSession } from "@/lib/server/auth";
import { changeOwnPassword } from "@/lib/server/account";
import { rateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  // Las cuentas de solo Google pueden establecer su primera contraseña.
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
});

/** Cambia la contraseña del usuario logueado. */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireUser();
  if (!rateLimit(`account:password:${session.id}`, 5, 15 * 60 * 1000).ok) throw new ApiError(429, "Demasiados intentos de cambio de contraseña");
  const { currentPassword, newPassword } = await parseBody(req, schema);
  await changeOwnPassword(session.id, currentPassword, newPassword);
  await createSession(session);
  return jsonOk({ message: "Contraseña actualizada" });
});
