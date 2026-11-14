import "server-only";
import { prisma } from "@/lib/prisma";
import { adminStoreId, requireCategory } from "./scope";
import { assertImageReferences } from "../storage";
import type { LegacyTransaction } from "../store-client";
import { ApiError } from "../api-helpers";
import { detachVariants, removeProduct } from "../catalog-deletion";

export interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  offerPrice: number | null;
  offerActive: boolean;
  /**
   * Stock que se muestra en el listado. Si el producto maneja colores, es la
   * SUMA del stock de sus colores (que es donde de verdad se descuenta al
   * vender); si no, el stock general del producto.
   */
  stock: number;
  /** `true` si el stock lo llevan los colores y no el campo general. */
  hasVariants: boolean;
  status: string;
  featured: boolean;
  /** Foto principal; `null` si el producto no tiene ninguna. */
  imageUrl: string | null;
}

export interface AdminVariantInput {
  name: string;
  colorHex?: string | null;
  stock: number;
}

export interface AdminProductDetail extends AdminProductRow {
  description: string | null;
  sku: string | null;
  /** Costo del producto (interno). `null` si no se ha registrado. */
  cost: number | null;
  /** Costo de envío propio. `null` = usa la tarifa general de la tienda. */
  shippingCost: number | null;
  badge: string | null;
  specs: { key: string; value: string }[];
  variants: AdminVariantInput[];
  /** Galería completa en orden (AdminProductRow ya trae la principal). */
  images: string[];
}

export interface ProductInput {
  name: string;
  slug: string;
  brand: string;
  description?: string;
  categorySlug: string;
  price: number;
  offerPrice?: number | null;
  offerActive?: boolean;
  /** Costo del producto (interno, para ganancias). */
  cost?: number | null;
  stock?: number;
  sku?: string | null;
  status?: "PUBLISHED" | "DRAFT" | "ARCHIVED";
  featured?: boolean;
  /** Costo de envío propio; `null` = usa la tarifa general de la tienda. */
  shippingCost?: number | null;
  badge?: string | null;
  specs?: { key: string; value: string }[];
  /** Colores/variantes; array vacío = el producto no maneja variantes. */
  variants?: AdminVariantInput[];
  /** Galería en orden; la primera es la principal. Vacío = sin fotos. */
  images?: string[];
}

function toRow(p: {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  price: unknown;
  offerPrice: unknown | null;
  offerActive: boolean;
  stock: number;
  status: string;
  featured: boolean;
  variants?: { stock: number }[];
  images?: { url: string }[];
}): AdminProductRow {
  // Con colores, el campo `stock` del producto queda sin usar: la venta
  // descuenta del color (ver el checkout en server/orders.ts). Mostrar ese
  // número en el listado hace creer que la venta no descontó nada.
  const hasVariants = (p.variants?.length ?? 0) > 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.categorySlug,
    price: Number(p.price),
    offerPrice: p.offerPrice === null ? null : Number(p.offerPrice),
    offerActive: p.offerActive,
    stock: hasVariants
      ? p.variants!.reduce((total, v) => total + v.stock, 0)
      : p.stock,
    hasVariants,
    status: p.status,
    featured: p.featured,
    imageUrl: p.images?.[0]?.url ?? null,
  };
}

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const storeId = await adminStoreId();
  const rows = await prisma.product.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    include: {
      images: { where: { storeId }, orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { where: { storeId }, select: { stock: true } },
    },
  });
  return rows.map(toRow);
}

export async function getAdminProduct(
  id: string,
): Promise<AdminProductDetail | null> {
  const storeId = await adminStoreId();
  const p = await prisma.product.findUnique({
    where: { id, storeId },
    include: {
      specs: { where: { storeId }, orderBy: { sortOrder: "asc" } },
      variants: { where: { storeId }, orderBy: { sortOrder: "asc" } },
      // La galería completa: el editor las muestra y reordena todas.
      images: { where: { storeId }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p) return null;
  return {
    ...toRow(p),
    // A propósito se pisa el stock efectivo con el general: el editor edita
    // ESE campo, y si recibiera la suma de los colores la guardaría encima.
    stock: p.stock,
    description: p.description,
    sku: p.sku,
    cost: p.cost === null ? null : Number(p.cost),
    shippingCost: p.shippingCost === null ? null : Number(p.shippingCost),
    badge: p.badge,
    specs: p.specs.map((s) => ({ key: s.key, value: s.value })),
    variants: p.variants.map((v) => ({
      name: v.name,
      colorHex: v.colorHex,
      stock: v.stock,
    })),
    images: p.images.map((i) => i.url),
  };
}

async function upsertExtras(
  tx: LegacyTransaction, storeId: string, productId: string,
  input: Pick<ProductInput, "specs" | "images" | "variants">,
) {
  if (input.specs) {
    await tx.productSpec.deleteMany({ where: { storeId, productId } });
    const clean = input.specs.filter((spec) => spec.key.trim() && spec.value.trim());
    if (clean.length) await tx.productSpec.createMany({
      data: clean.map((spec, sortOrder) => ({ storeId, productId, key: spec.key.trim(), value: spec.value.trim(), sortOrder })),
    });
  }
  if (input.variants) {
    await detachVariants(tx, productId);
    await tx.productVariant.deleteMany({ where: { storeId, productId } });
    const clean = input.variants.filter((variant) => variant.name.trim());
    if (clean.length) await tx.productVariant.createMany({
      data: clean.map((variant, sortOrder) => ({ storeId, productId, name: variant.name.trim(), colorHex: variant.colorHex || null, stock: variant.stock, sortOrder })),
    });
  }
  if (input.images !== undefined) {
    await tx.productImage.deleteMany({ where: { storeId, productId } });
    const clean = input.images.map((url) => url.trim()).filter(Boolean);
    if (clean.length) await tx.productImage.createMany({
      data: clean.map((url, sortOrder) => ({ storeId, productId, url, sortOrder, isPrimary: sortOrder === 0 })),
    });
  }
}

function baseData(input: ProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    brand: input.brand,
    description: input.description ?? null,
    categorySlug: input.categorySlug,
    price: input.price,
    offerPrice: input.offerPrice ?? null,
    offerActive: input.offerActive ?? false,
    cost: input.cost ?? null,
    stock: input.stock ?? 0,
    sku: input.sku || null,
    status: input.status ?? "PUBLISHED",
    featured: input.featured ?? false,
    shippingCost: input.shippingCost ?? null,
    badge: input.badge || null,
  };
}

function productWriteError(error: unknown): never {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "P2002") throw new ApiError(409, "Conflicto de slug, SKU o especificación del producto");
  if (code === "P2003") throw new ApiError(404, "Una referencia del producto ya no está disponible");
  if (code === "P2000") throw new ApiError(400, "Un valor del producto excede el tamaño permitido");
  throw error;
}

export async function createProduct(input: ProductInput): Promise<AdminProductRow> {
  const storeId = await adminStoreId();
  await assertImageReferences(input.images ?? []);
  return prisma.$transaction(async (tx) => {
    await requireCategory(input.categorySlug, storeId, tx);
    const dup = await tx.product.findUnique({ where: { storeId_slug: { storeId, slug: input.slug } } });
    if (dup) throw new ApiError(409, "Ya existe un producto con ese slug");
    const created = await tx.product.create({ data: { ...baseData(input), storeId } });
    await upsertExtras(tx, storeId, created.id, input);
    return toRow(created);
  }).catch(productWriteError);
}

export async function updateProduct(id: string, input: ProductInput): Promise<AdminProductRow> {
  const storeId = await adminStoreId();
  return prisma.$transaction(async (tx) => {
    if (!await tx.product.findUnique({ where: { id, storeId }, select: { id: true } })) throw new ApiError(404, "Producto no encontrado");
    await requireCategory(input.categorySlug, storeId, tx);
    await assertImageReferences(input.images ?? []);
    const dup = await tx.product.findFirst({ where: { storeId, slug: input.slug, id: { not: id } } });
    if (dup) throw new ApiError(409, "Ya existe otro producto con ese slug");
    const updated = await tx.product.update({ where: { id, storeId }, data: baseData(input) });
    await upsertExtras(tx, storeId, id, input);
    return toRow(updated);
  }).catch(productWriteError);
}

export async function deleteProduct(id: string): Promise<void> {
  const storeId = await adminStoreId();
  await prisma.$transaction(async (tx) => {
    if (!await tx.product.findUnique({ where: { id, storeId }, select: { id: true } })) throw new ApiError(404, "Producto no encontrado");
    await removeProduct(tx, id);
  });
}

export async function setProductOffer(id: string, offer: { offerActive: boolean; offerPrice?: number | null }): Promise<AdminProductRow> {
  const storeId = await adminStoreId();
  if (!await prisma.product.findUnique({ where: { id, storeId }, select: { id: true } })) throw new ApiError(404, "Producto no encontrado");
  return toRow(await prisma.product.update({
    where: { id, storeId },
    data: { offerActive: offer.offerActive, ...(offer.offerPrice !== undefined ? { offerPrice: offer.offerPrice } : {}) },
  }));
}
