import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { retryOrderPayment } from "@/lib/server/orders";

/**
 * Devuelve un enlace de pago nuevo para un pedido pendiente.
 *
 * Sin cuerpo: basta el código del pedido. `retryOrderPayment` comprueba que
 * quien pide sea el dueño (o un admin) y que el pedido siga sin pagar.
 */
export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
    const { code } = await ctx.params;
    return jsonOk(await retryOrderPayment(code));
  },
);
