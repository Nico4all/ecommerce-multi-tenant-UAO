import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { listAdminPayments } from "@/lib/server/admin/orders";

export const GET = withErrorHandling(async () => {
  return jsonOk(await listAdminPayments());
});
