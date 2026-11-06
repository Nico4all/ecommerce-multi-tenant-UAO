import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getAdminStats } from "@/lib/server/admin/stats";

export const GET = withErrorHandling(async () => {
  return jsonOk(await getAdminStats());
});
