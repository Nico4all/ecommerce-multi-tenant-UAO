import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import {
  listAdminCategories,
  createCategory,
} from "@/lib/server/admin/categories";
import { categorySchema } from "@/lib/server/admin/schemas";

export const GET = withErrorHandling(async () => {
  return jsonOk(await listAdminCategories());
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, categorySchema);
  return jsonOk(await createCategory(body), { status: 201 });
});
