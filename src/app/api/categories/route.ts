import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getCategories } from "@/lib/queries";

export const GET = withErrorHandling(async () => {
  return jsonOk(await getCategories());
});
