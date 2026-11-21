import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, getStoreContext } from "@/lib/prisma";
import { ApiError } from "./api-helpers";
import { getSession, requireUser } from "./auth";
import { reserveOrderStock } from "./stock";
import { toDomainProduct } from "./mappers";
import { validateDiscount, redeemDiscount } from "./discounts";
import { notifyOrderCreated, notifyLowStockAfterSale } from "./notifications";
import { alertStoreOrderCreated } from "./store-alerts";
import { sendOrderConfirmationEmail } from "./order-emails";
import {
  buildWompiCheckoutUrl,
  buildPaymentReference,
  wompiConfigured,
} from "./wompi";
import { shippingFor } from "@/lib/shipping";

/**
 * WOMPI = pago en línea vía la pasarela (tarjeta, PSE, Nequi…).
 * COD   = contra entrega: efectivo al recibir el pedido.
 */
export type CheckoutMethod = "WOMPI" | "COD";

export interface CheckoutInput {
  contact: { name: string; email: string; phone: string };
  shipping: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    reference?: string;
  };
  method: CheckoutMethod;
  discountCode?: string;
}

export interface CheckoutResult {
  code: string;
  total: number;
  status: string;
  paymentStatus: string;
  /** Solo WOMPI: URL de la pasarela a la que el front debe redirigir. */
  redirectUrl?: string;
}

/** Código global sin contador compartido entre tiendas o requests concurrentes. */
function nextOrderCode(): string {
  return `VLP-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

/** Reserva, snapshots, descuento y consumo del carrito se confirman juntos. */
export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const session = await requireUser();
  const store = await getStoreContext();
  const storeId = store.id;
  if (input.method === "WOMPI" && !wompiConfigured()) {
    throw new ApiError(503, "Los pagos en línea no están disponibles en este momento. Elige contra entrega o intenta más tarde.");
  }
  const { order, cart, total, redirectUrl } = await prisma.$transaction(async (tx) => {
    const current = await tx.cart.findUnique({
      where: { storeId_userId: { storeId, userId: session.id } }, select: { id: true },
    });
    if (!current) throw new ApiError(400, "Tu carrito está vacío");
    // Bloquear el carrito antes de leerlo impide dos checkouts de la misma compra.
    await tx.cart.update({ where: { id: current.id, storeId, userId: session.id }, data: { updatedAt: new Date() } });
    const rows = await tx.cartItem.findMany({
      where: { storeId, cartId: current.id },
      include: { product: { include: { variants: { where: { storeId }, select: { id: true } } } }, variant: true },
      orderBy: { id: "asc" },
    });
    if (!rows.length) throw new ApiError(400, "Tu carrito está vacío");
    for (const row of rows) {
      if (row.product.status !== "PUBLISHED" ||
        (row.variantId && (!row.variant || row.variant.productId !== row.productId)) ||
        (!row.variantId && row.product.variants.length > 0)) {
        throw new ApiError(409, "Un producto o variante ya no está disponible");
      }
    }
    const lines = rows.map((row) => ({
      product: toDomainProduct(row.product), qty: row.qty, variantId: row.variantId,
      variantName: row.variant?.name ?? null,
    }));
    const subtotal = lines.reduce((sum, line) => sum + Math.round(line.product.price * 100) * line.qty, 0) / 100;
    const discount = input.discountCode ? await validateDiscount(input.discountCode, subtotal, tx) : null;
    const discountTotal = discount?.amount ?? 0;
    const shippingCost = discount?.freeShipping ? 0 : shippingFor(subtotal, lines.map((line) => ({ shippingCost: line.product.shippingCost })));
    const total = Math.max(0, subtotal - discountTotal) + shippingCost;
    const code = nextOrderCode();
    const redirectUrl = input.method === "WOMPI" ? buildWompiCheckoutUrl({
      reference: buildPaymentReference(code, 1), amountInCents: Math.round(total * 100),
      customerEmail: input.contact.email, customerName: input.contact.name,
      redirectUrl: `${store.origin}/checkout/confirmacion`,
    }) : undefined;
    await reserveOrderStock(tx, rows);
    const order = await tx.order.create({
      data: {
        storeId, code, userId: session.id, status: "PENDING",
        email: input.contact.email, phone: input.contact.phone, shippingName: input.contact.name,
        street: input.shipping.street, city: input.shipping.city, state: input.shipping.state,
        zip: input.shipping.zip, country: input.shipping.country, reference: input.shipping.reference ?? null,
        subtotal, shippingCost, discountTotal, total,
      },
    });
    await tx.orderItem.createMany({
      data: lines.map((line, index) => ({
        storeId, orderId: order.id, productId: line.product.id, variantId: line.variantId,
        name: line.product.name, brand: line.product.brand, variantName: line.variantName,
        unitPrice: line.product.price, unitCost: rows[index].product.cost, qty: line.qty,
      })),
    });
    await tx.payment.create({
      data: {
        storeId, orderId: order.id, method: input.method, status: "PENDING", amount: total,
        gatewayReference: input.method === "WOMPI" ? buildPaymentReference(code, 1) : null,
      },
    });
    await tx.orderStatusEvent.create({ data: { storeId, orderId: order.id, status: "PENDING" } });
    if (discount) await redeemDiscount(tx, discount, { orderId: order.id, userId: session.id, amount: discountTotal });
    // Conservar líneas nuevas; abortar si una cantidad cambió durante el checkout.
    for (const row of rows) {
      const removed = await tx.cartItem.deleteMany({ where: { id: row.id, storeId, cartId: current.id, qty: row.qty } });
      if (removed.count !== 1) throw new ApiError(409, "Tu carrito cambió. Revisa la compra e intenta de nuevo.");
    }
    return { order, cart: { lines }, total, redirectUrl };
  }, { isolationLevel: "ReadCommitted", timeout: 15000 });

  // Avisos y correo. Van fuera de la transacción y a propósito no se esperan
  // dentro de ella: si notificar o el correo fallan, la venta ya está hecha y
  // no se toca.
  await notifyOrderCreated({
    orderId: order.id,
    code: order.code,
    total,
    paid: false,
    method: input.method,
    customerName: input.contact.name,
  });
  // El mismo aviso, por correo, al buzón del equipo.
  await alertStoreOrderCreated({
    orderId: order.id,
    code: order.code,
    total,
    method: input.method,
    paid: false,
    customerName: input.contact.name,
    customerEmail: input.contact.email,
    customerPhone: input.contact.phone,
    city: input.shipping.city,
  });
  await notifyLowStockAfterSale(
    cart.lines.map((l) => ({ productId: l.product.id, variantId: l.variantId })),
  );

  // Contra entrega: el pedido queda confirmado ya (se cobra al recibir), así
  // que el correo sale ahora. Con Wompi el correo sale al APROBARSE el pago
  // (lo dispara applyWompiTransaction), no aquí.
  if (input.method === "COD") {
    await sendOrderConfirmationEmail(order.id).catch(() => console.error("[orders] No se pudo enviar la confirmación del pedido"));
  }

  return {
    code: order.code,
    total,
    status: order.status,
    paymentStatus: "PENDING",
    redirectUrl,
  };
}

// ---------------------------------------------------------------------------
// Lecturas ("Mis pedidos")
// ---------------------------------------------------------------------------

export interface MyOrderSummary {
  code: string;
  date: string;
  status: string;
  items: number;
  total: number;
  trackingUrl: string | null;
}

export async function getMyOrders(): Promise<MyOrderSummary[]> {
  const user = await requireUser();
  const { id: storeId } = await getStoreContext();
  const orders = await prisma.order.findMany({
    where: { storeId, userId: user.id },
    include: { items: { where: { storeId }, select: { qty: true } } },
    orderBy: { createdAt: "desc" },
  });
  return orders.map((o) => ({
    code: o.code,
    date: o.createdAt.toISOString().slice(0, 10),
    status: o.status,
    items: o.items.reduce((s, i) => s + i.qty, 0),
    total: Number(o.total),
    trackingUrl: o.trackingUrl,
  }));
}

export interface OrderDetail {
  code: string;
  date: string;
  status: string;
  subtotal: number;
  shippingCost: number;
  discountTotal: number;
  total: number;
  shippingName: string;
  address: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: {
    name: string;
    brand: string;
    variantName: string | null;
    qty: number;
    unitPrice: number;
  }[];
  events: { status: string; createdAt: string }[];
  isGuest: boolean;
  /** Método del último intento de pago; `null` si el pedido no tiene ninguno. */
  paymentMethod: string | null;
}

/**
 * Detalle por código. Reglas: el dueño lo ve; un admin lo ve; una orden de
 * invitado (sin userId) se puede consultar con su código (página de éxito).
 */
export async function getOrderByCode(code: string): Promise<OrderDetail | null> {
  const session = await getSession();
  const { id: storeId } = await getStoreContext();
  const o = await prisma.order.findUnique({
    where: { code, storeId },
    include: {
      items: { where: { storeId } },
      events: { where: { storeId }, orderBy: { createdAt: "asc" } },
      payments: { where: { storeId }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!o) return null;

  const isOwner = session && o.userId === session.id;
  const isAdmin = session?.role === "ADMIN";
  const isGuestOrder = o.userId === null;
  if (!isOwner && !isAdmin && !isGuestOrder) {
    throw new ApiError(403, "No puedes ver este pedido");
  }

  return {
    code: o.code,
    date: o.createdAt.toISOString().slice(0, 10),
    status: o.status,
    subtotal: Number(o.subtotal),
    shippingCost: Number(o.shippingCost),
    discountTotal: Number(o.discountTotal),
    total: Number(o.total),
    shippingName: o.shippingName,
    address: `${o.street}, ${o.city}, ${o.state} ${o.zip}, ${o.country}`,
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    items: o.items.map((i) => ({
      name: i.name,
      brand: i.brand,
      variantName: i.variantName,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
    })),
    events: o.events.map((e) => ({
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
    isGuest: isGuestOrder,
    paymentMethod: o.payments[0]?.method ?? null,
  };
}

/**
 * Genera un enlace de pago NUEVO para un pedido que sigue pendiente.
 *
 * Hace falta porque Wompi quema la referencia en el primer intento: si al
 * cliente le declinan la tarjeta, volver al enlace anterior devuelve 422 ("La
 * referencia ya ha sido usada") y se queda sin forma de pagar su pedido. Cada
 * llamada cuenta los intentos previos y pide una referencia distinta.
 *
 * Solo el dueño del pedido (o un admin) puede pedirlo, y solo mientras el
 * pedido siga PENDING: nunca se puede volver a cobrar algo ya pagado.
 */
export async function retryOrderPayment(
  code: string,
): Promise<{ redirectUrl: string }> {
  const session = await getSession();
  const store = await getStoreContext();
  const storeId = store.id;
  return prisma.$transaction(async (tx) => {
    const found = await tx.order.findUnique({ where: { code, storeId }, select: { id: true } });
    if (!found) throw new ApiError(404, "Pedido no encontrado");
    await tx.order.update({ where: { id: found.id, storeId }, data: { updatedAt: new Date() } });
    const order = await tx.order.findUniqueOrThrow({
      where: { id: found.id, storeId },
      include: { payments: { where: { storeId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    if (!session || (order.userId !== session.id && session.role !== "ADMIN")) throw new ApiError(403, "No puedes pagar este pedido");
    if (order.status !== "PENDING" || order.inventoryRestoredAt) throw new ApiError(409, "Este pedido ya no está pendiente de pago.");
    if (!order.payments.some((payment) => payment.method === "WOMPI")) throw new ApiError(400, "Este pedido no se paga por Wompi.");
    if (!wompiConfigured()) throw new ApiError(503, "Los pagos en línea no están configurados.");
    const reference = buildPaymentReference(order.code, order.payments.length + 1);
    const redirectUrl = buildWompiCheckoutUrl({
      reference, amountInCents: Math.round(Number(order.total) * 100),
      customerEmail: order.email, customerName: order.shippingName,
      redirectUrl: `${store.origin}/checkout/confirmacion`,
    });
    await tx.payment.create({
      data: { storeId, orderId: order.id, method: "WOMPI", status: "PENDING", amount: order.total, gatewayReference: reference },
    });
    return { redirectUrl };
  }, { isolationLevel: "ReadCommitted" });
}
