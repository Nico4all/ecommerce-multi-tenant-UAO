import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import {
  getAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from "@/lib/server/admin/users";
import { userSchema } from "@/lib/server/admin/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await getAdminUser(id);
  if (!user) throw new ApiError(404, "Usuario no encontrado");
  return jsonOk(user);
});

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, userSchema);
  return jsonOk(await updateAdminUser(id, body));
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteAdminUser(id);
  return jsonOk(null);
});
