import "server-only";
import type { LegacyTransaction } from "./store-client";

/** Conserva los snapshots antes de retirar variantes con FKs multitienda. */
export async function detachVariants(tx: LegacyTransaction, productId: string) {
  const { storeId } = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  await tx.cartItem.updateMany({ where: { storeId, productId }, data: { variantId: null } });
  await tx.orderItem.updateMany({ where: { storeId, productId }, data: { variantId: null } });
}

export async function removeProduct(tx: LegacyTransaction, productId: string) {
  const { storeId } = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  await detachVariants(tx, productId);
  await tx.orderItem.updateMany({
    where: { storeId, productId },
    data: { productId: null, variantId: null },
  });
  await tx.product.delete({ where: { id: productId, storeId } });
}

export async function removeCategory(tx: LegacyTransaction, slug: string) {
  const category = await tx.category.findFirstOrThrow({ where: { slug } });
  await tx.homeSection.updateMany({ where: { storeId: category.storeId, categorySlug: slug }, data: { categorySlug: null } });
  await tx.category.delete({ where: { storeId_slug: { storeId: category.storeId, slug } } });
}
