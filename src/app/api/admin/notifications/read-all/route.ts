import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { markAllNotificationsRead } from "@/lib/server/notifications";

/** Marca como leídos todos los avisos pendientes. */
export const POST = withErrorHandling(async () => {
  const count = await markAllNotificationsRead();
  return jsonOk({ count });
});
