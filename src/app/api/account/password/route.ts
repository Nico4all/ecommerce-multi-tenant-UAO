import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { requireUser } from "@/lib/server/auth";
import { changeOwnPassword } from "@/lib/server/account";

const schema = z.object({
  // Opcional: las cuentas creadas con Google (login ya retirado) todavía
  // pueden no tener contraseña actual que confirmar.
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
});

/** Cambia la contraseña del usuario logueado. */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireUser();
  const { currentPassword, newPassword } = await parseBody(req, schema);
  await changeOwnPassword(session.id, currentPassword, newPassword);
  return jsonOk({ message: "Contraseña actualizada" });
});
