import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import {
  listAdminProducts,
  createProduct,
} from "@/lib/server/admin/products";
import { productSchema } from "@/lib/server/admin/schemas";

export const GET = withErrorHandling(async () => {
  return jsonOk(await listAdminProducts());
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, productSchema);
  return jsonOk(await createProduct(body), { status: 201 });
});
