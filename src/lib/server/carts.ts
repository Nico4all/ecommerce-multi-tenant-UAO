import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ApiError } from "./api-helpers";
import { getSession } from "./auth";
import { toDomainProduct, PRODUCT_IMAGE_INCLUDE } from "./mappers";
import type { Product } from "@/types";

/**
 * Carrito persistente en DB (tablas Cart/CartItem):
 * - Usuario logueado: carrito por userId.
 * - Invitado: carrito por sessionId guardado en la cookie `vlp_cart_sid`.
 * - Al iniciar sesión, `mergeGuestCart` fusiona el carrito invitado en el del usuario.
 *
 * Nota: solo los route handlers pueden ESCRIBIR cookies; por eso `getCart`
 * (usada por RSC) es de solo lectura y `ensureCart` (mutaciones) crea la cookie.
 */

const SID_COOKIE = "vlp_cart_sid";
const SID_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

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

const cartInclude = {
  items: {
    include: {
      // La foto del producto viaja hasta el carrito y el checkout.
      product: { include: PRODUCT_IMAGE_INCLUDE },
      variant: true,
    },
    orderBy: { id: "asc" as const },
  },
};

type CartWithItems = NonNullable<
  Awaited<ReturnType<typeof findCurrentCart>>
>;

async function findCurrentCart() {
  const session = await getSession();
  if (session) {
    return prisma.cart.findUnique({
      where: { userId: session.id },
      include: cartInclude,
    });
  }
  const sid = (await cookies()).get(SID_COOKIE)?.value;
  if (!sid) return null;
  return prisma.cart.findUnique({
    where: { sessionId: sid },
    include: cartInclude,
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
  const session = await getSession();
  if (session) {
    return prisma.cart.upsert({
      where: { userId: session.id },
      update: {},
      create: { userId: session.id },
    });
  }
  const store = await cookies();
  const sid = store.get(SID_COOKIE)?.value;
  if (sid) {
    const existing = await prisma.cart.findUnique({ where: { sessionId: sid } });
    if (existing) return existing;
  }
  const newSid = crypto.randomUUID();
  store.set(SID_COOKIE, newSid, {
    httpOnly: true,
    sameSite: "lax",
    // Actívalo con COOKIE_SECURE="true" al desplegar detrás de HTTPS.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SID_MAX_AGE,
  });
  return prisma.cart.create({ data: { sessionId: newSid } });
}

export async function addToCart(input: {
  productId?: string;
  slug?: string;
  qty: number;
  variantId?: string;
}): Promise<CartSummary> {
  const where = input.productId
    ? { id: input.productId }
    : input.slug
      ? { slug: input.slug }
      : null;
  if (!where) throw new ApiError(400, "Falta productId o slug");

  const product = await prisma.product.findFirst({
    where: { ...where, status: "PUBLISHED" },
    include: { variants: true },
  });
  if (!product) throw new ApiError(404, "Producto no encontrado");

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
    where: { cartId: cart.id, productId: product.id, variantId },
  });
  const newQty = (existing?.qty ?? 0) + input.qty;
  if (maxStock > 0 && newQty > maxStock) {
    throw new ApiError(400, `Solo quedan ${maxStock} unidades disponibles`);
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { qty: newQty },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, variantId, qty: input.qty },
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
  await prisma.cartItem.update({ where: { id: itemId }, data: { qty } });
  return getCart();
}

export async function removeCartItem(itemId: string): Promise<CartSummary> {
  const cart = await findCurrentCart();
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw new ApiError(404, "Artículo no encontrado en tu carrito");
  await prisma.cartItem.delete({ where: { id: itemId } });
  return getCart();
}

/** Vacía el carrito actual (post-checkout). */
export async function clearCurrentCart() {
  const cart = await findCurrentCart();
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}

/** Fusiona el carrito de invitado en el del usuario (tras login/registro). */
export async function mergeGuestCart(userId: string) {
  const store = await cookies();
  const sid = store.get(SID_COOKIE)?.value;
  if (!sid) return;

  const guest = await prisma.cart.findUnique({
    where: { sessionId: sid },
    include: { items: true },
  });
  if (!guest) {
    store.delete(SID_COOKIE);
    return;
  }

  const userCart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  if (guest.id !== userCart.id) {
    for (const item of guest.items) {
      const existing = await prisma.cartItem.findFirst({
        where: {
          cartId: userCart.id,
          productId: item.productId,
          variantId: item.variantId,
        },
      });
      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { qty: existing.qty + item.qty },
        });
        await prisma.cartItem.delete({ where: { id: item.id } });
      } else {
        await prisma.cartItem.update({
          where: { id: item.id },
          data: { cartId: userCart.id },
        });
      }
    }
    await prisma.cart.delete({ where: { id: guest.id } }).catch(() => {});
  }
  store.delete(SID_COOKIE);
}
