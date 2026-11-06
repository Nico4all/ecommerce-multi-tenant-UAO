import "server-only";
import type { Product, CategorySlug } from "@/types";

/**
 * Fila de Prisma -> tipo de dominio `Product` de la UI.
 * En BD: `price` es el precio base y la oferta vive en offerPrice/offerActive.
 * En el dominio de la UI: `price` es el vigente y `oldPrice` el tachado.
 */
export type DbProductRow = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: unknown; // Prisma.Decimal
  offerPrice: unknown | null;
  offerActive: boolean;
  ratingAvg: unknown; // Prisma.Decimal
  reviewCount: number;
  shippingCost: unknown | null; // Prisma.Decimal | null
  badge: string | null;
  categorySlug: string;
  /**
   * Imágenes del producto. Es opcional porque no todas las consultas la piden;
   * quien quiera que la foto llegue a la UI tiene que incluir la relación
   * (ver `PRODUCT_IMAGE_INCLUDE`).
   */
  images?: { url: string }[];
};

/**
 * Include estándar para que `toDomainProduct` pueda devolver la foto.
 * Va aquí para que ningún call site se olvide de pedirla: sin esto el producto
 * viaja sin imagen y la tienda pinta el mosaico de la categoría.
 */
export const PRODUCT_IMAGE_INCLUDE = {
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
} as const;

/**
 * La galería completa. Solo la necesita la ficha del producto; el resto de la
 * tienda se conforma con la principal y no tiene sentido que cargue 8 filas por
 * cada tarjeta de un listado.
 */
export const PRODUCT_GALLERY_INCLUDE = {
  images: { orderBy: { sortOrder: "asc" } },
} as const;

export function toDomainProduct(p: DbProductRow): Product {
  const base = Number(p.price);
  const offer = p.offerPrice === null ? null : Number(p.offerPrice);
  const onSale = p.offerActive && offer !== null && offer < base;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.categorySlug as CategorySlug,
    price: onSale ? (offer as number) : base,
    oldPrice: onSale ? base : undefined,
    rating: Number(p.ratingAvg),
    reviews: p.reviewCount,
    shippingCost: p.shippingCost === null ? null : Number(p.shippingCost),
    badge: p.badge ?? undefined,
    imageUrl: p.images?.[0]?.url ?? null,
  };
}
