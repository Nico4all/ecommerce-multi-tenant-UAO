import "server-only";
import type { LegacyTransaction } from "./store-client";
import { ORIGINAL_STORE_ID } from "../../../prisma/stores";

/** Conserva los snapshots antes de retirar variantes con FKs multitienda. */
export async function detachVariants(tx: LegacyTransaction, productId: string) {
  await tx.cartItem.updateMany({ where: { productId }, data: { variantId: null } });
  await tx.orderItem.updateMany({ where: { productId }, data: { variantId: null } });
}

export async function removeProduct(tx: LegacyTransaction, productId: string) {
  await detachVariants(tx, productId);
  await tx.orderItem.updateMany({
    where: { productId },
    data: { productId: null, variantId: null },
  });
  await tx.product.delete({ where: { id: productId } });
}

export async function removeCategory(tx: LegacyTransaction, slug: string) {
  await tx.homeSection.updateMany({ where: { categorySlug: slug }, data: { categorySlug: null } });
  await tx.category.delete({ where: { storeId_slug: { storeId: ORIGINAL_STORE_ID, slug } } });
}
