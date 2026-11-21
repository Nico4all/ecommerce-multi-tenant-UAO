import "server-only";
import type { WompiTransaction } from "./wompi";

/** La cancelación administrativa no convierte un cobro aprobado en rechazo. */
export function wompiReturnLocation(
  transaction: Pick<WompiTransaction, "status"> | null,
  order: { code: string; status: string } | null,
): string {
  if (!transaction || !order) return "/orders?pago=sin-confirmar";
  const declined = transaction.status === "DECLINED" && order.status === "CANCELLED";
  return `/checkout/success/${encodeURIComponent(order.code)}${declined ? "?pago=rechazado" : ""}`;
}
