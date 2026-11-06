import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getMyOrders } from "@/lib/server/orders";

export const GET = withErrorHandling(async () => {
  return jsonOk(await getMyOrders());
});
