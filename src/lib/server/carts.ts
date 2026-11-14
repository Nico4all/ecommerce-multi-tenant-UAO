import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma, getStoreContext } from "@/lib/prisma";
import { ORIGINAL_STORE_ID } from "../../../prisma/stores";
import { ApiError } from "./api-helpers";
import { getSession } from "./auth";
import { toDomainProduct, PRODUCT_IMAGE_INCLUDE } from "./mappers";
import type { Product } from "@/types";

/**
 * Carrito persistente en DB (tablas Cart/CartItem):
 * - Usuario logueado: carrito por tienda y userId.
 * - Invitado: cookie y sessionId vinculados a la tienda validada.
 * - Al iniciar sesión, `mergeGuestCart` fusiona el carrito invitado en el del usuario.
 *
 * Nota: solo los route handlers pueden ESCRIBIR cookies; por eso `getCart`
 * (usada por RSC) es de solo lectura y `ensureCart` (mutaciones) crea la cookie.
 */

const LEGACY_SID_COOKIE = "vlp_cart_sid";
const SID_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function guestIdentity(storeId: string, jar: Awaited<ReturnType<typeof cookies>>) {
  const namespace = createHash("sha256").update(storeId).digest("hex").slice(0, 24);
  const name = `${LEGACY_SID_COOKIE}_${namespace}`;
  const value = jar.get(name)?.value;
  // Copiar el valor de A bajo el nombre de cookie de B tampoco lo habilita.
  const scoped = value && new RegExp(`^${namespace}\\.[a-f0-9-]{36}$`).test(value) ? value : undefined;
  const legacy = storeId === ORIGINAL_STORE_ID ? jar.get(LEGACY_SID_COOKIE)?.value : undefined;
  return { name, namespace, sid: scoped ?? (legacy && legacy.length <= 200 ? legacy : undefined), legacy: !scoped && !!legacy };
}

export interface CartLine {
  id: string;
  qty: number;
  product: Product;
  variantId: string | null;
  variantName: string | null;
  variantColor: string | null;
}

export interface CartSummary {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
}

const EMPTY: CartSummary = { lines: [], itemCount: 0, subtotal: 0 };

const cartInclude = (storeId: string) => ({
  items: {
    where: { storeId },
    include: {
      // La foto del producto viaja hasta el carrito y el checkout.
      product: { include: { images: { ...PRODUCT_IMAGE_INCLUDE.images, where: { storeId } } } },
      variant: true,
    },
    orderBy: { id: "asc" as const },
  },
});

type CartWithItems = NonNullable<
  Awaited<ReturnType<typeof findCurrentCart>>
>;

async function findCurrentCart() {
  const { id: storeId } = await getStoreContext();
  const session = await getSession();
  if (session) {
    return prisma.cart.findUnique({
      where: { storeId_userId: { storeId, userId: session.id } },
      include: cartInclude(storeId),
    });
  }
  const { sid } = guestIdentity(storeId, await cookies());
  if (!sid) return null;
  return prisma.cart.findUnique({
    where: { storeId_sessionId: { storeId, sessionId: sid }, userId: null },
    include: cartInclude(storeId),
  });
}

function summarize(cart: CartWithItems): CartSummary {
  const lines: CartLine[] = cart.items.map((item) => ({
    id: item.id,
    qty: item.qty,
    product: toDomainProduct(item.product),
    variantId: item.variantId,
    variantName: item.variant?.name ?? null,
    variantColor: item.variant?.colorHex ?? null,
  }));
  return {
    lines,
    itemCount: lines.reduce((s, l) => s + l.qty, 0),
    subtotal: lines.reduce((s, l) => s + l.product.price * l.qty, 0),
  };
}

/** Carrito actual (RSC-safe, no escribe cookies). */
export async function getCart(): Promise<CartSummary> {
  const cart = await findCurrentCart();
  return cart ? summarize(cart) : EMPTY;
}

export async function getCartCount(): Promise<number> {
  return (await getCart()).itemCount;
}

/** Crea el carrito (y la cookie de invitado) si no existe. Solo route handlers. */
async function ensureCart() {
  const { id: storeId } = await getStoreContext();
  const session = await getSession();
  if (session) {
    return prisma.cart.upsert({
      where: { storeId_userId: { storeId, userId: session.id } },
      update: {},
      create: { storeId, userId: session.id },
    });
  }
  const jar = await cookies();
  const identity = guestIdentity(storeId, jar);
  const existing = identity.sid ? await prisma.cart.findUnique({
    where: { storeId_sessionId: { storeId, sessionId: identity.sid }, userId: null },
  }) : null;
  if (existing && !identity.legacy) return existing;
  const newSid = `${identity.namespace}.${crypto.randomUUID()}`;
  // Rotar la identidad antigua únicamente en la tienda original.
  const cart = existing
    ? await prisma.cart.update({ where: { id: existing.id, storeId, userId: null }, data: { sessionId: newSid } })
    : await prisma.cart.create({ data: { storeId, sessionId: newSid } });
  jar.set(identity.name, newSid, {
    httpOnly: true,
    sameSite: "lax",
    // Actívalo con COOKIE_SECURE="true" al desplegar detrás de HTTPS.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SID_MAX_AGE,
  });
  if (identity.legacy) jar.delete(LEGACY_SID_COOKIE);
  return cart;
}

export async function addToCart(input: {
  productId?: string;
  slug?: string;
  qty: number;
  variantId?: string;
}): Promise<CartSummary> {
  const { id: storeId } = await getStoreContext();
  const where = input.productId
    ? { id: input.productId }
    : input.slug
      ? { slug: input.slug }
      : null;
  if (!where) throw new ApiError(400, "Falta productId o slug");

  const product = await prisma.product.findFirst({
    where: { ...where, storeId, status: "PUBLISHED" },
    include: { variants: { where: { storeId } } },
  });
  if (!product) throw new ApiError(404, "Producto no encontrado");
  if (input.variantId && !product.variants.some((v) => v.id === input.variantId)) {
    throw new ApiError(400, "Selecciona un color disponible");
  }

  // Si el producto maneja variantes, exigirla y validar su stock propio.
  let variantId: string | null = null;
  let maxStock = product.stock;
  if (product.variants.length > 0) {
    const variant = product.variants.find((v) => v.id === input.variantId);
    if (!variant) throw new ApiError(400, "Selecciona un color disponible");
    variantId = variant.id;
    maxStock = variant.stock;
  }

  const cart = await ensureCart();
  const existing = await prisma.cartItem.findFirst({
    where: { storeId, cartId: cart.id, productId: product.id, variantId },
  });
  const newQty = (existing?.qty ?? 0) + input.qty;
  if (maxStock > 0 && newQty > maxStock) {
    throw new ApiError(400, `Solo quedan ${maxStock} unidades disponibles`);
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id, storeId, cartId: cart.id },
      data: { qty: newQty },
    });
  } else {
    await prisma.cartItem.create({
      data: { storeId, cartId: cart.id, productId: product.id, variantId, qty: input.qty },
    });
  }
  return getCart();
}

export async function updateCartItem(
  itemId: string,
  qty: number,
): Promise<CartSummary> {
  const cart = await findCurrentCart();
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw new ApiError(404, "Artículo no encontrado en tu carrito");
  const maxStock = item.variant ? item.variant.stock : item.product.stock;
  if (maxStock > 0 && qty > maxStock) {
    throw new ApiError(400, `Solo quedan ${maxStock} unidades disponibles`);
  }
  await prisma.cartItem.update({ where: { id: itemId, storeId: cart.storeId, cartId: cart.id }, data: { qty } });
  return getCart();
}

export async function removeCartItem(itemId: string): Promise<CartSummary> {
  const cart = await findCurrentCart();
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw new ApiError(404, "Artículo no encontrado en tu carrito");
  await prisma.cartItem.delete({ where: { id: itemId, storeId: cart.storeId, cartId: cart.id } });
  return getCart();
}

/** Vacía el carrito actual (post-checkout). */
export async function clearCurrentCart() {
  const cart = await findCurrentCart();
  if (cart) await prisma.cartItem.deleteMany({ where: { storeId: cart.storeId, cartId: cart.id } });
}

/** Fusiona el carrito de invitado en el del usuario (tras login/registro). */
export async function mergeGuestCart(userId: string) {
  const { id: storeId } = await getStoreContext();
  const jar = await cookies();
  const identity = guestIdentity(storeId, jar);
  const { sid } = identity;
  if (!sid) return;
  await prisma.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({
      where: { storeId_sessionId: { storeId, sessionId: sid }, userId: null },
    });
    if (!guest) return;
    // Reclamar con un UPDATE condicional serializa dos logins con la misma cookie.
    // La identidad y los artículos se restauran si falla cualquier paso del merge.
    const claimed = await tx.cart.updateMany({
      where: { id: guest.id, storeId, sessionId: sid, userId: null },
      data: { sessionId: null },
    });
    if (!claimed.count) return;
    const items = await tx.cartItem.findMany({ where: { storeId, cartId: guest.id } });
    const userCart = await tx.cart.upsert({
      where: { storeId_userId: { storeId, userId } },
      update: {}, create: { storeId, userId },
    });
    for (const item of items) {
      const existing = await tx.cartItem.findFirst({
        where: {
          storeId,
          cartId: userCart.id,
          productId: item.productId,
          variantId: item.variantId,
        },
      });
      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id, storeId, cartId: userCart.id },
          data: { qty: { increment: item.qty } },
        });
        await tx.cartItem.delete({ where: { id: item.id, storeId, cartId: guest.id } });
      } else {
        await tx.cartItem.update({
          where: { id: item.id, storeId, cartId: guest.id },
          data: { cartId: userCart.id },
        });
      }
    }
    await tx.cart.delete({ where: { id: guest.id, storeId, userId: null } });
  }, { isolationLevel: "ReadCommitted" });
  jar.delete(identity.name);
  if (identity.legacy) jar.delete(LEGACY_SID_COOKIE);
}
