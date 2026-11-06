import "server-only";
import { prisma } from "@/lib/prisma";
import { ApiError } from "./api-helpers";
import { getSession, requireUser } from "./auth";
import { getCart, clearCurrentCart } from "./carts";
import { validateDiscount } from "./discounts";
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

/** Siguiente código de orden VLP-XXXXX (secuencial sobre el mayor existente). */
async function nextOrderCode(): Promise<string> {
  const last = await prisma.order.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastNum = last ? Number(last.code.replace(/\D/g, "")) : 10234;
  return `VLP-${(Number.isFinite(lastNum) ? lastNum : 10234) + 1}`;
}

/**
 * Checkout transaccional: valida el carrito y el stock, aplica descuento,
 * crea Order + OrderItems (snapshot) + Payment + eventos, descuenta stock
 * y canjea el cupón. Al final vacía el carrito.
 */
export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  // Comprar exige cuenta: sin ella el cliente no tendría dónde ver sus pedidos.
  // (El carrito sí funciona de invitado y se fusiona al iniciar sesión.)
  const session = await requireUser();
  const cart = await getCart();
  if (cart.lines.length === 0) {
    throw new ApiError(400, "Tu carrito está vacío");
  }
  // Falla temprano, ANTES de crear la orden: sin llaves no hay a dónde redirigir.
  if (input.method === "WOMPI" && !wompiConfigured()) {
    throw new ApiError(
      503,
      "Los pagos en línea no están disponibles en este momento. Elige contra entrega o intenta más tarde.",
    );
  }

  // Recalcular todo del lado servidor (nunca confiar en montos del cliente).
  const subtotal = cart.subtotal;
  let shippingCost = shippingFor(
    subtotal,
    cart.lines.map((l) => ({ shippingCost: l.product.shippingCost })),
  );
  let discountTotal = 0;
  let discount = null as Awaited<ReturnType<typeof validateDiscount>> | null;

  if (input.discountCode) {
    discount = await validateDiscount(input.discountCode, subtotal);
    discountTotal = discount.amount;
    if (discount.freeShipping) shippingCost = 0;
  }

  const total = Math.max(0, subtotal - discountTotal) + shippingCost;

  // Validar stock actual antes de la transacción (por variante si aplica).
  for (const line of cart.lines) {
    if (line.variantId) {
      const v = await prisma.productVariant.findUnique({
        where: { id: line.variantId },
        select: { stock: true, name: true },
      });
      if (v && v.stock > 0 && line.qty > v.stock) {
        throw new ApiError(
          400,
          `Sin stock suficiente de "${line.product.name}" en ${v.name} (quedan ${v.stock})`,
        );
      }
      continue;
    }
    const p = await prisma.product.findUnique({
      where: { id: line.product.id },
      select: { stock: true, name: true },
    });
    if (p && p.stock > 0 && line.qty > p.stock) {
      throw new ApiError(
        400,
        `Sin stock suficiente de "${p.name}" (quedan ${p.stock})`,
      );
    }
  }

  // Costo de cada producto para snapshot en el OrderItem (base de las ganancias).
  // Se lee ahora, no del carrito, porque el costo es interno y no viaja al cliente.
  const productIds = [...new Set(cart.lines.map((l) => l.product.id))];
  const costRows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, cost: true },
  });
  const costMap = new Map(
    costRows.map((r) => [r.id, r.cost === null ? null : Number(r.cost)]),
  );

  // Con pasarela real ya no hay pagos "instantáneos": toda orden nace PENDIENTE.
  // WOMPI se confirma por webhook/retorno; COD se cobra al entregar.
  const code = await nextOrderCode();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        code,
        userId: session.id,
        status: "PENDING",
        email: input.contact.email,
        phone: input.contact.phone,
        shippingName: input.contact.name,
        street: input.shipping.street,
        city: input.shipping.city,
        state: input.shipping.state,
        zip: input.shipping.zip,
        country: input.shipping.country,
        reference: input.shipping.reference ?? null,
        subtotal,
        shippingCost,
        discountTotal,
        total,
      },
    });

    await tx.orderItem.createMany({
      data: cart.lines.map((l) => ({
        orderId: created.id,
        productId: l.product.id,
        variantId: l.variantId,
        name: l.product.name,
        brand: l.product.brand,
        variantName: l.variantName,
        unitPrice: l.product.price,
        unitCost: costMap.get(l.product.id) ?? null,
        qty: l.qty,
      })),
    });

    // Descontar stock (de la variante si aplica; si no, del producto).
    for (const l of cart.lines) {
      if (l.variantId) {
        await tx.productVariant.updateMany({
          where: { id: l.variantId, stock: { gte: l.qty } },
          data: { stock: { decrement: l.qty } },
        });
      } else {
        await tx.product.updateMany({
          where: { id: l.product.id, stock: { gte: l.qty } },
          data: { stock: { decrement: l.qty } },
        });
      }
    }

    await tx.payment.create({
      data: {
        orderId: created.id,
        method: input.method,
        status: "PENDING",
        amount: total,
        // WOMPI: la referencia se completa con el id de transacción al aprobar.
        // COD: queda null; el cobro es en efectivo al entregar.
        reference: null,
      },
    });

    await tx.orderStatusEvent.create({
      data: { orderId: created.id, status: "PENDING" },
    });

    if (discount) {
      await tx.discountRedemption.create({
        data: {
          codeId: discount.codeId,
          orderId: created.id,
          userId: session.id,
          amount: discountTotal,
        },
      });
      await tx.discountCode.update({
        where: { id: discount.codeId },
        data: {
          usedCount: { increment: 1 },
          ...(discount.type === "GIFT_CARD"
            ? { balance: { decrement: discountTotal } }
            : {}),
        },
      });
    }

    return created;
  });

  await clearCurrentCart();

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
    await sendOrderConfirmationEmail(order.id);
  }

  let redirectUrl: string | undefined;
  if (input.method === "WOMPI") {
    redirectUrl = buildWompiCheckoutUrl({
      reference: buildPaymentReference(order.code, 1),
      // COP no usa decimales en la práctica, pero Wompi exige centavos enteros.
      amountInCents: Math.round(total * 100),
      customerEmail: input.contact.email,
      customerName: input.contact.name,
      redirectUrl: `${process.env.APP_URL || "http://localhost:3000"}/checkout/confirmacion`,
    });
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
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: { select: { qty: true } } },
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
  const o = await prisma.order.findUnique({
    where: { code },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
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

  const order = await prisma.order.findUnique({
    where: { code },
    include: { payments: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw new ApiError(404, "Pedido no encontrado");

  const isOwner = session && order.userId === session.id;
  const isAdmin = session?.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "No puedes pagar este pedido");
  }
  if (order.status !== "PENDING") {
    throw new ApiError(409, "Este pedido ya no está pendiente de pago.");
  }
  if (!order.payments.some((p) => p.method === "WOMPI")) {
    throw new ApiError(400, "Este pedido no se paga por Wompi.");
  }
  if (!wompiConfigured()) {
    throw new ApiError(503, "Los pagos en línea no están configurados.");
  }

  // Un registro de pago por intento: además de dar el número de intento, deja
  // rastro en /admin/payments de cuántas veces se probó.
  const attempt = order.payments.length + 1;
  await prisma.payment.create({
    data: {
      orderId: order.id,
      method: "WOMPI",
      status: "PENDING",
      amount: order.total,
      reference: null,
    },
  });

  return {
    redirectUrl: buildWompiCheckoutUrl({
      reference: buildPaymentReference(order.code, attempt),
      amountInCents: Math.round(Number(order.total) * 100),
      customerEmail: order.email,
      customerName: order.shippingName,
      redirectUrl: `${process.env.APP_URL || "http://localhost:3000"}/checkout/confirmacion`,
    }),
  };
}
