import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { updateBanner, deleteBanner } from "@/lib/server/admin/banners";
import { bannerSchema } from "@/lib/server/admin/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, bannerSchema);
  return jsonOk(await updateBanner(id, body));
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteBanner(id);
  return jsonOk(null);
});
