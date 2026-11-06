import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { sendOrderEmail } from "@/lib/server/admin/orders";
import { orderEmailSchema } from "@/lib/server/admin/schemas";

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await parseBody(req, orderEmailSchema);
    return jsonOk(await sendOrderEmail(id, body.includeTracking), {
      status: 201,
    });
  },
);
