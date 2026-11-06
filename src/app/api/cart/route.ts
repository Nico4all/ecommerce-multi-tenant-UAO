import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getCart } from "@/lib/server/carts";

export const GET = withErrorHandling(async () => {
  return jsonOk(await getCart());
});
