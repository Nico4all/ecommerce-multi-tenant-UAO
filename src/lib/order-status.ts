/** Mapeo de enums de la BD (inglés) a las etiquetas de la UI (español). */

/**
 * Pasos del envío en orden, para el stepper de seguimiento (tienda y panel).
 * Las claves son las etiquetas en español que devuelve `ORDER_STATUS_LABEL`.
 */
export const fulfillmentSteps: { key: string; label: string }[] = [
  { key: "pagado", label: "Pagado" },
  { key: "empacando", label: "Empacando" },
  { key: "enviado", label: "Enviado" },
  { key: "en_camino", label: "En camino" },
  { key: "entregado", label: "Entregado" },
];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "pendiente",
  PAID: "pagado",
  PACKING: "empacando",
  SHIPPED: "enviado",
  IN_TRANSIT: "en_camino",
  DELIVERED: "entregado",
  CANCELLED: "cancelado",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  COMPLETED: "completado",
  PENDING: "pendiente",
  REFUNDED: "reembolsado",
  FAILED: "fallido",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CARD: "Tarjeta",
  PAYPAL: "PayPal",
  EFECTY: "Efecty",
  TRANSFER: "Transferencia",
  PSE: "PSE",
  WOMPI: "Wompi (en línea)",
  COD: "Contra entrega",
};

export const DISCOUNT_TYPE_LABEL: Record<string, string> = {
  PERCENT: "Porcentaje",
  FIXED: "Monto fijo",
  FREE_SHIPPING: "Envío gratis",
  GIFT_CARD: "Tarjeta de regalo",
};
