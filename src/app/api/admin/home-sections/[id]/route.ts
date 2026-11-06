import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import {
  updateHomeSection,
  deleteHomeSection,
} from "@/lib/server/admin/home-sections";
import { homeSectionSchema } from "@/lib/server/admin/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, homeSectionSchema);
  return jsonOk(await updateHomeSection(id, body));
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteHomeSection(id);
  return jsonOk(null);
});
