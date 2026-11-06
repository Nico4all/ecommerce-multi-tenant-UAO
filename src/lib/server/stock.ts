import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Devuelve al inventario las unidades de una orden (al cancelarla).
 *
 * El checkout descuenta stock al crear la orden (reserva); si el pago falla o
 * el admin cancela, esas unidades deben volver. Guarda de idempotencia: si la
 * orden ya tiene un evento CANCELLED previo, no se repone de nuevo (evita
 * doble reposición si el webhook se repite o el admin re-cancela).
 */
export async function restockOrderOnce(orderId: string): Promise<void> {
  const alreadyCancelled = await prisma.orderStatusEvent.count({
    where: { orderId, status: "CANCELLED" },
  });
  if (alreadyCancelled > 0) return;

  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { productId: true, variantId: true, qty: true },
  });

  for (const item of items) {
    if (item.variantId) {
      await prisma.productVariant.updateMany({
        where: { id: item.variantId },
        data: { stock: { increment: item.qty } },
      });
    } else if (item.productId) {
      await prisma.product.updateMany({
        where: { id: item.productId },
        data: { stock: { increment: item.qty } },
      });
    }
    // productId null = el producto se borró del catálogo: no hay dónde reponer.
  }
}
