import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import {
  getAdminOrder,
  updateAdminOrder,
} from "@/lib/server/admin/orders";
import { orderUpdateSchema } from "@/lib/server/admin/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const order = await getAdminOrder(id);
  if (!order) throw new ApiError(404, "Pedido no encontrado");
  return jsonOk(order);
});

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, orderUpdateSchema);
  return jsonOk(
    await updateAdminOrder(id, {
      ...body,
      trackingUrl: body.trackingUrl === "" ? null : body.trackingUrl,
    }),
  );
});
