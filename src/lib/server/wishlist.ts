import { ORIGINAL_STORE_ID } from "../../../prisma/stores";
import "server-only";
import { prisma } from "@/lib/prisma";
import { requireUser } from "./auth";
import { ApiError } from "./api-helpers";
import { toDomainProduct } from "./mappers";
import type { Product } from "@/types";

/** Favoritos del usuario logueado (requiere sesión). */
export async function getWishlist(): Promise<Product[]> {
  const user = await requireUser();
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  return items.map((i) => toDomainProduct(i.product));
}

/** Agrega o quita un producto. Devuelve si quedó agregado. */
export async function toggleWishlist(productId: string): Promise<boolean> {
  const user = await requireUser();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, "Producto no encontrado");

  const key = { storeId: ORIGINAL_STORE_ID, userId: user.id, productId };
  const existing = await prisma.wishlistItem.findUnique({
    where: { storeId_userId_productId: key },
  });
  if (existing) {
    await prisma.wishlistItem.delete({ where: { storeId_userId_productId: key } });
    return false;
  }
  await prisma.wishlistItem.create({ data: key });
  return true;
}

export async function removeFromWishlist(productId: string): Promise<void> {
  const user = await requireUser();
  await prisma.wishlistItem
    .delete({ where: { storeId_userId_productId: { storeId: ORIGINAL_STORE_ID, userId: user.id, productId } } })
    .catch(() => {});
}
