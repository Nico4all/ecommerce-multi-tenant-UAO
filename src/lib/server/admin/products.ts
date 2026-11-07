import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { requireAdmin } from "../auth";
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
  await requireAdmin();
  const rows = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { select: { stock: true } },
    },
  });
  return rows.map(toRow);
}

export async function getAdminProduct(
  id: string,
): Promise<AdminProductDetail | null> {
  await requireAdmin();
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      specs: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
      // La galería completa: el editor las muestra y reordena todas.
      images: { orderBy: { sortOrder: "asc" } },
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
  productId: string,
  input: Pick<ProductInput, "specs" | "images" | "variants">,
) {
  if (input.specs) {
    await prisma.productSpec.deleteMany({ where: { productId } });
    const clean = input.specs.filter((s) => s.key.trim() && s.value.trim());
    if (clean.length) {
      await prisma.productSpec.createMany({
        data: clean.map((s, i) => ({
          productId,
          key: s.key.trim(),
          value: s.value.trim(),
          sortOrder: i,
        })),
      });
    }
  }
  if (input.variants) {
    const clean = input.variants.filter((v) => v.name.trim());
    await prisma.$transaction(async (tx) => {
      await detachVariants(tx, productId);
      await tx.productVariant.deleteMany({ where: { productId } });
      if (clean.length) {
        await tx.productVariant.createMany({
          data: clean.map((v, i) => ({
            productId,
            name: v.name.trim(),
            colorHex: v.colorHex || null,
            stock: v.stock,
            sortOrder: i,
          })),
        });
      }
    });
  }
  if (input.images !== undefined) {
    // Reemplazo total: el orden que manda el panel es la verdad. `sortOrder`
    // fija cómo se ven y la primera queda marcada como principal, que es la que
    // sale en el catálogo, el carrito y los avisos.
    await prisma.productImage.deleteMany({ where: { productId } });
    const clean = input.images.map((u) => u.trim()).filter(Boolean);
    if (clean.length) {
      await prisma.productImage.createMany({
        data: clean.map((url, i) => ({
          productId,
          url,
          sortOrder: i,
          isPrimary: i === 0,
        })),
      });
    }
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

export async function createProduct(input: ProductInput): Promise<AdminProductRow> {
  await requireAdmin();
  const dup = await prisma.product.findUnique({ where: { storeId_slug: { storeId: (await getStoreContext()).id, slug: input.slug } } });
  if (dup) throw new ApiError(409, "Ya existe un producto con ese slug");
  const created = await prisma.product.create({ data: baseData(input) });
  await upsertExtras(created.id, input);
  return toRow(created);
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<AdminProductRow> {
  await requireAdmin();
  const dup = await prisma.product.findFirst({
    where: { slug: input.slug, id: { not: id } },
  });
  if (dup) throw new ApiError(409, "Ya existe otro producto con ese slug");
  const updated = await prisma.product
    .update({ where: { id }, data: baseData(input) })
    .catch(() => null);
  if (!updated) throw new ApiError(404, "Producto no encontrado");
  await upsertExtras(id, input);
  return toRow(updated);
}

export async function deleteProduct(id: string): Promise<void> {
  await requireAdmin();
  await prisma.$transaction((tx) => removeProduct(tx, id)).catch(() => {
    throw new ApiError(404, "Producto no encontrado");
  });
}

/** Toggle de oferta desde /admin/offers. */
export async function setProductOffer(
  id: string,
  offer: { offerActive: boolean; offerPrice?: number | null },
): Promise<AdminProductRow> {
  await requireAdmin();
  const updated = await prisma.product
    .update({
      where: { id },
      data: {
        offerActive: offer.offerActive,
        ...(offer.offerPrice !== undefined ? { offerPrice: offer.offerPrice } : {}),
      },
    })
    .catch(() => null);
  if (!updated) throw new ApiError(404, "Producto no encontrado");
  return toRow(updated);
}
