import { adminExportSelection } from "@/lib/server/admin/scope";
import { listAdminOrders } from "@/lib/server/admin/orders";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/order-status";
import { csvResponse, today } from "@/lib/server/csv";
import { withErrorHandling } from "@/lib/server/api-helpers";

/** Exporta todos los pedidos a CSV (botón "Exportar" del dashboard). */
export const GET = withErrorHandling(async (request: Request) => {
  const selection = await adminExportSelection(request, "orders");
  const orders = await listAdminOrders(undefined, selection.ids);
  return csvResponse(
    `pedidos-${today()}.csv`,
    ["Código", "Fecha", "Cliente", "Estado", "Método de pago", "Artículos", "Total"],
    orders.map((o) => [
      o.code,
      o.date,
      o.userName,
      ORDER_STATUS_LABEL[o.status] ?? o.status,
      PAYMENT_METHOD_LABEL[o.method] ?? o.method,
      o.items,
      o.total,
    ]),
  );
});
