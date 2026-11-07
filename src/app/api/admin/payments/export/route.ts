import { requireAdmin } from "@/lib/server/auth";
import { listAdminPayments } from "@/lib/server/admin/orders";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/order-status";
import { csvResponse, today } from "@/lib/server/csv";
import { withErrorHandling } from "@/lib/server/api-helpers";

/** Exporta todas las transacciones a CSV (botón "Exportar CSV" de /admin/payments). */
export const GET = withErrorHandling(async () => {
  try {
    await requireAdmin();
  } catch {
    return new Response("No autorizado", { status: 401 });
  }

  const payments = await listAdminPayments();
  return csvResponse(
    `pagos-${today()}.csv`,
    ["Pedido", "Cliente", "Método", "Fecha", "Estado", "Monto"],
    payments.map((p) => [
      p.orderCode,
      p.userName,
      PAYMENT_METHOD_LABEL[p.method] ?? p.method,
      p.date,
      PAYMENT_STATUS_LABEL[p.status] ?? p.status,
      p.amount,
    ]),
  );
});
