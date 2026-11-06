import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { setUserPassword } from "@/lib/server/admin/users";
import { adminPasswordSchema } from "@/lib/server/admin/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Reset de contraseña por el admin: fija una nueva y se la pasa al usuario. */
export const POST = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { password } = await parseBody(req, adminPasswordSchema);
  await setUserPassword(id, password);
  return jsonOk({ message: "Contraseña actualizada" });
});
