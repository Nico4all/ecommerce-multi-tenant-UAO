import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { toDomainProduct, PRODUCT_GALLERY_INCLUDE } from "./mappers";
import type { Product } from "@/types";

export interface ProductSpecItem {
  key: string;
  value: string;
}

export interface ProductReviewItem {
  id: string;
  userName: string;
  rating: number;
  body: string;
  createdAt: string; // ISO
}

export interface ProductVariantItem {
  id: string;
  name: string;
  colorHex: string | null;
  stock: number;
  priceDelta: number;
}

export interface ProductDetail {
  product: Product;
  stock: number;
  description: string | null;
  specs: ProductSpecItem[];
  reviews: ProductReviewItem[];
  variants: ProductVariantItem[];
  /** Galería en orden; vacía si el producto no tiene fotos propias. */
  images: string[];
}

/**
 * Detalle completo para la PDP (specs + reseñas + variantes reales).
 * `null` si el producto no existe en la base: no hay respaldo inventado.
 */
export async function getProductDetail(
  slug: string,
): Promise<ProductDetail | null> {
  const { id: storeId } = await getStoreContext();
  const row = await prisma.product.findUnique({
    where: { storeId_slug: { storeId, slug }, status: "PUBLISHED" },
    include: {
      ...PRODUCT_GALLERY_INCLUDE,
      images: { ...PRODUCT_GALLERY_INCLUDE.images, where: { storeId } },
      specs: { where: { storeId }, orderBy: { sortOrder: "asc" } },
      variants: { where: { storeId }, orderBy: { sortOrder: "asc" } },
      reviews: {
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!row) return null;

  return {
    product: toDomainProduct(row),
    stock: row.stock,
    description: row.description,
    specs: row.specs.map((s) => ({ key: s.key, value: s.value })),
    variants: row.variants.map((v) => ({
      id: v.id,
      name: v.name,
      colorHex: v.colorHex,
      stock: v.stock,
      priceDelta: Number(v.priceDelta),
    })),
    reviews: row.reviews.map((r) => ({
      id: r.id,
      userName: r.user.name,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
    images: row.images.map((i) => i.url),
  };
}
