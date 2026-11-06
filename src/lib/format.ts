const priceFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  // El peso colombiano no usa centavos en el día a día.
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formatea un número como precio de la tienda. Cambia locale/currency aquí. */
export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

const compact = new Intl.NumberFormat("es-CO", { notation: "compact" });

/** 12000 -> "12 mil" style compact number for review counts. */
export function formatCount(value: number): string {
  return compact.format(value);
}

/** Porcentaje de descuento a partir de precio actual y anterior. */
export function discountPercent(price: number, oldPrice?: number): number | null {
  if (!oldPrice || oldPrice <= price) return null;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}
