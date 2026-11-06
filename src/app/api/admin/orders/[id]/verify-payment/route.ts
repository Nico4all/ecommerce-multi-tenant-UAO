import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { verifyOrderPayment } from "@/lib/server/admin/orders";

/**
 * Concilia un pedido contra Wompi desde el panel.
 *
 * Sin cuerpo: todo lo que hace falta es el id del pedido (la referencia que se
 * le consulta a Wompi es su código). `verifyOrderPayment` exige admin.
 */
export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    return jsonOk(await verifyOrderPayment(id));
  },
);
