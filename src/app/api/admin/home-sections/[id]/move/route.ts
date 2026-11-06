import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { moveHomeSection } from "@/lib/server/admin/home-sections";
import { moveSectionSchema } from "@/lib/server/admin/schemas";

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await parseBody(req, moveSectionSchema);
    await moveHomeSection(id, body.direction);
    return jsonOk(null);
  },
);
