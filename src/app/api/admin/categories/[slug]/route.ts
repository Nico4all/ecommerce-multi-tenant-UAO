import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import {
  updateCategory,
  deleteCategory,
} from "@/lib/server/admin/categories";
import { categorySchema } from "@/lib/server/admin/schemas";

type Ctx = { params: Promise<{ slug: string }> };

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const body = await parseBody(req, categorySchema.omit({ slug: true }));
  return jsonOk(await updateCategory(slug, body));
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  await deleteCategory(slug);
  return jsonOk(null);
});
