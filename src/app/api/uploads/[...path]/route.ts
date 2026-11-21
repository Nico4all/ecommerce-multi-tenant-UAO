import { uploadResponse } from "@/lib/server/upload-response";
import { withErrorHandling } from "@/lib/server/api-helpers";

type Ctx = { params: Promise<{ path: string[] }> };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { path: segments } = await ctx.params;
  return uploadResponse(segments.join("/"));
});
