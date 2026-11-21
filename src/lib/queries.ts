import "server-only";
import { connection } from "next/server";
import { prisma, getStoreContext } from "./prisma";
import { toDomainProduct as toProduct, PRODUCT_IMAGE_INCLUDE } from "./server/mappers";
import type { Category, Product } from "@/types";

/**
 * Capa de acceso a datos del catálogo. La ÚNICA fuente es MariaDB.
 *
 * No hay respaldo a datos de ejemplo a propósito: si un producto no está en la
 * base, la tienda debe decir que no existe. Antes había un fallback a `mock`
 * que revivía productos borrados desde el panel (y podía mostrar catálogo
 * inventado en producción). Las fixtures de ejemplo viven ahora en
 * `prisma/seed-data/`, y solo las usa el seed.
 *
 * Modelo de datos: prisma/schema.prisma (docs/modelo-de-datos.md).
 */

export type SortKey =
  | "relevance"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "discount";

export interface ProductQuery {
  category?: string;
  search?: string;
  brands?: string[];
  minRating?: number;
  onlyDeals?: boolean;
  sort?: SortKey;
}

function discount(p: Product) {
  return p.oldPrice ? (p.oldPrice - p.price) / p.oldPrice : 0;
}

function sortProducts(list: Product[], sort: SortKey = "relevance"): Product[] {
  const arr = [...list];
  switch (sort) {
    case "price-asc":
      return arr.sort((a, b) => a.price - b.price);
    case "price-desc":
      return arr.sort((a, b) => b.price - a.price);
    case "rating":
      return arr.sort((a, b) => b.rating - a.rating);
    case "discount":
      return arr.sort((a, b) => discount(b) - discount(a));
    default:
      return arr;
  }
}

export async function getCategories(): Promise<Category[]> {
  await connection();
  const { id: storeId } = await getStoreContext();
  const rows = await prisma.category.findMany({ where: { storeId }, orderBy: { name: "asc" } });
  return rows as Category[];
}

export async function getCategory(slug: string): Promise<Category | null> {
  await connection();
  const { id: storeId } = await getStoreContext();
  const row = await prisma.category.findUnique({ where: { storeId_slug: { storeId, slug } } });
  return (row as Category) ?? null;
}

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  await connection();
  const { id: storeId } = await getStoreContext();
  const rows = await prisma.product.findMany({
    where: {
      storeId,
      status: "PUBLISHED",
      categorySlug: query.category,
      ratingAvg: query.minRating ? { gte: query.minRating } : undefined,
      brand: query.brands?.length ? { in: query.brands } : undefined,
      offerActive: query.onlyDeals ? true : undefined,
      // Sin `mode: "insensitive"`: es exclusivo de PostgreSQL. MariaDB compara
      // sin distinguir mayúsculas por la colación utf8mb4_unicode_ci.
      OR: query.search
        ? [
            { name: { contains: query.search } },
            { brand: { contains: query.search } },
          ]
        : undefined,
    },
    include: { images: { ...PRODUCT_IMAGE_INCLUDE.images, where: { storeId } } },
  });
  return sortProducts(rows.map(toProduct), query.sort);
}

export async function getProduct(slug: string): Promise<Product | null> {
  await connection();
  const { id: storeId } = await getStoreContext();
  const row = await prisma.product.findUnique({
    where: { storeId_slug: { storeId, slug }, status: "PUBLISHED" },
    include: { images: { ...PRODUCT_IMAGE_INCLUDE.images, where: { storeId } } },
  });
  return row ? toProduct(row) : null;
}

export async function getRelatedProducts(
  product: Product,
  limit = 5,
): Promise<Product[]> {
  await connection();
  const { id: storeId } = await getStoreContext();
  const anchor = await prisma.product.findFirst({
    where: { storeId, id: product.id, slug: product.slug, status: "PUBLISHED" },
    select: { categorySlug: true },
  });
  if (!anchor) return [];
  const rows = await prisma.product.findMany({
    where: {
      storeId,
      status: "PUBLISHED",
      categorySlug: anchor.categorySlug,
      id: { not: product.id },
    },
    take: limit,
    include: { images: { ...PRODUCT_IMAGE_INCLUDE.images, where: { storeId } } },
  });
  return rows.map(toProduct);
}

export async function getBrands(category?: string): Promise<string[]> {
  await connection();
  const { id: storeId } = await getStoreContext();
  const rows = await prisma.product.findMany({
    where: { storeId, status: "PUBLISHED", categorySlug: category },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  });
  return rows.map((r) => r.brand);
}
