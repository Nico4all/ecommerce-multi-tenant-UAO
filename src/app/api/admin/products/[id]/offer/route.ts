import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { setProductOffer } from "@/lib/server/admin/products";
import { offerSchema } from "@/lib/server/admin/schemas";

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await parseBody(req, offerSchema);
    return jsonOk(await setProductOffer(id, body));
  },
);
