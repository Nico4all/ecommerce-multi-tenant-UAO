import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { markNotificationRead } from "@/lib/server/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** Marca un aviso como leído. */
export const PATCH = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await markNotificationRead(id);
  return jsonOk(null);
});
