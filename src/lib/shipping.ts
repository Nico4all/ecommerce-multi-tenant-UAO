/** Reglas de envío compartidas entre UI y servidor. Montos en pesos colombianos. */
export const FREE_SHIPPING_THRESHOLD = 150000;
export const SHIPPING_COST = 15000;

/** Tarifa general de la tienda (no toma en cuenta costos propios de producto). */
function storeDefaultShipping(subtotal: number): number {
  return subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
}

export interface ShippableLine {
  /** Costo de envío propio del producto. `null`/`undefined` = sin costo propio. */
  shippingCost?: number | null;
}

/**
 * Envío del pedido completo.
 *
 * Es un solo paquete, así que no se suman costos por artículo: si algún
 * producto del carrito trae un costo de envío propio (`shippingCost` no nulo,
 * fijado en el catálogo), se cobra el MÁS ALTO de esos costos propios —
 * ignorando la tarifa general, incluso si hay otros productos sin costo propio
 * en el mismo pedido. Si NINGÚN producto define uno, se aplica la tarifa
 * general de la tienda (gratis sobre `FREE_SHIPPING_THRESHOLD`).
 *
 * Repetir el mismo producto (mayor cantidad) no cambia el resultado: es el
 * costo del artículo dentro del paquete, no un cargo por unidad.
 */
export function shippingFor(subtotal: number, lines: ShippableLine[] = []): number {
  const overrides = lines
    .map((l) => l.shippingCost)
    .filter((c): c is number => c !== null && c !== undefined);

  if (overrides.length > 0) return Math.max(...overrides);
  return storeDefaultShipping(subtotal);
}
