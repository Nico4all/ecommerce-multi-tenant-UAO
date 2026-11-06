import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import {
  getAdminProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/server/admin/products";
import { productSchema } from "@/lib/server/admin/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const product = await getAdminProduct(id);
  if (!product) throw new ApiError(404, "Producto no encontrado");
  return jsonOk(product);
});

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, productSchema);
  return jsonOk(await updateProduct(id, body));
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteProduct(id);
  return jsonOk(null);
});
