import {
  withErrorHandling,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import { getProductDetail } from "@/lib/server/catalog";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const detail = await getProductDetail(slug);
    if (!detail) throw new ApiError(404, "Producto no encontrado");
    return jsonOk(detail);
  },
);
