import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import {
  updateDiscount,
  deleteDiscount,
} from "@/lib/server/admin/discounts";
import { discountSchema } from "@/lib/server/admin/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, discountSchema);
  return jsonOk(await updateDiscount(id, body));
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteDiscount(id);
  return jsonOk(null);
});
