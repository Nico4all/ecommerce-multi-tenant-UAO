import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import {
  listAdminOrders,
  type AdminOrderStatus,
} from "@/lib/server/admin/orders";

const STATUSES: AdminOrderStatus[] = [
  "PENDING",
  "PAID",
  "PACKING",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
];

export const GET = withErrorHandling(async (req: Request) => {
  const raw = new URL(req.url).searchParams.get("status");
  const status = STATUSES.includes(raw as AdminOrderStatus)
    ? (raw as AdminOrderStatus)
    : undefined;
  return jsonOk(await listAdminOrders(status));
});
