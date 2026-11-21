import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { requireUser } from "./auth";
import { ApiError } from "./api-helpers";
import { toDomainProduct } from "./mappers";
import type { Product } from "@/types";

/** Favoritos del usuario logueado (requiere sesión). */
export async function getWishlist(): Promise<Product[]> {
  const user = await requireUser();
  const { id: storeId } = await getStoreContext();
  const items = await prisma.wishlistItem.findMany({
    where: { storeId, userId: user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  return items.map((i) => toDomainProduct(i.product));
}

/** Agrega o quita un producto. Devuelve si quedó agregado. */
export async function toggleWishlist(productId: string): Promise<boolean> {
  const user = await requireUser();
  const { id: storeId } = await getStoreContext();
  const product = await prisma.product.findUnique({ where: { id: productId, storeId } });
  if (!product) throw new ApiError(404, "Producto no encontrado");

  const key = { storeId, userId: user.id, productId };
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
  const { id: storeId } = await getStoreContext();
  await prisma.wishlistItem.deleteMany({ where: { storeId, userId: user.id, productId } });
}
