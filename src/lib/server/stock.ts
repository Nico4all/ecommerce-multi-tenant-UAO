import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { ApiError } from "./api-helpers";
import type { LegacyTransaction } from "./store-client";

/** Reserva condicional dentro de checkout: cero unidades significa agotado. */
export async function reserveOrderStock(
  tx: LegacyTransaction,
  lines: { productId: string; variantId: string | null; qty: number }[],
) {
  const { id: storeId } = await getStoreContext();
  for (const line of [...lines].sort((a, b) => `${a.productId}/${a.variantId}`.localeCompare(`${b.productId}/${b.variantId}`))) {
    if (!Number.isSafeInteger(line.qty) || line.qty <= 0) throw new ApiError(400, "Cantidad inválida en el carrito");
    const reserved = line.variantId
      ? await tx.productVariant.updateMany({
        where: { id: line.variantId, storeId, productId: line.productId, stock: { gte: line.qty }, product: { status: "PUBLISHED" } },
        data: { stock: { decrement: line.qty } },
      })
      : await tx.product.updateMany({
        where: { id: line.productId, storeId, status: "PUBLISHED", stock: { gte: line.qty } },
        data: { stock: { decrement: line.qty } },
      });
    if (reserved.count !== 1) throw new ApiError(409, "Un producto ya no está disponible en la cantidad solicitada");
  }
}

/** Marca y reposición se confirman juntas; el llamador cambia el estado en el mismo tx. */
export async function restockOrderOnce(orderId: string, transaction?: LegacyTransaction): Promise<void> {
  const { id: storeId } = await getStoreContext();
  const restore = async (tx: LegacyTransaction) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, storeId, inventoryRestoredAt: null }, data: { inventoryRestoredAt: new Date() },
    });
    if (!claimed.count) return;
    const items = await tx.orderItem.findMany({
      where: { storeId, orderId }, select: { productId: true, variantId: true, qty: true },
    });
    for (const item of items) {
      if (!Number.isSafeInteger(item.qty) || item.qty <= 0) throw new ApiError(409, "El inventario de este pedido requiere revisión");
      if (item.variantId && item.productId) {
        await tx.productVariant.updateMany({
          where: { id: item.variantId, storeId, productId: item.productId }, data: { stock: { increment: item.qty } },
        });
      } else if (item.productId) {
        await tx.product.updateMany({ where: { id: item.productId, storeId }, data: { stock: { increment: item.qty } } });
      }
    }
  };
  if (transaction) await restore(transaction);
  else await prisma.$transaction(restore, { isolationLevel: "ReadCommitted" });
}
