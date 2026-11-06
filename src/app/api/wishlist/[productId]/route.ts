import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { removeFromWishlist } from "@/lib/server/wishlist";

export const DELETE = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
    const { productId } = await ctx.params;
    await removeFromWishlist(productId);
    return jsonOk(null);
  },
);
