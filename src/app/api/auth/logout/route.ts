import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { destroySession } from "@/lib/server/auth";

export const POST = withErrorHandling(async () => {
  await destroySession();
  return jsonOk(null);
});
