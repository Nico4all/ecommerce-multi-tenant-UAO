import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { sweepUploads } from "@/lib/server/admin/uploads-gc";

/**
 * Barrido de imágenes huérfanas (limpieza de uploads/).
 *
 *   POST /api/admin/uploads/gc            -> borra los huérfanos
 *   POST /api/admin/uploads/gc?dryRun=1   -> solo reporta, no borra
 *
 * Solo admin (lo revalida `sweepUploads` con requireAdmin, además del proxy).
 */
export const POST = withErrorHandling(async (req: Request) => {
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const report = await sweepUploads({ dryRun });
  return jsonOk(report);
});
