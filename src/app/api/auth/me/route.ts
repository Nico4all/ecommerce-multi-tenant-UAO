import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getSession } from "@/lib/server/auth";

export const GET = withErrorHandling(async () => {
  const session = await getSession();
  return jsonOk(session);
});
