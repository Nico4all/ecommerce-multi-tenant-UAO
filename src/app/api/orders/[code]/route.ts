import {
  withErrorHandling,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import { getOrderByCode } from "@/lib/server/orders";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
    const { code } = await ctx.params;
    const order = await getOrderByCode(code);
    if (!order) throw new ApiError(404, "Pedido no encontrado");
    return jsonOk(order);
  },
);
