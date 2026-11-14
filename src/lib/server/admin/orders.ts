import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { requireAdmin } from "../auth";
import { ApiError } from "../api-helpers";
import { sendOrderEmailManual, sendOrderShippedEmail } from "../order-emails";
import { restockOrderOnce } from "../stock";
import {
  applyWompiTransaction,
  fetchWompiTransactionsByReference,
  wompiConfigured,
} from "../wompi";
import type { CategorySlug } from "@/types";

export type AdminOrderStatus =
  | "PENDING"
  | "PAID"
  | "PACKING"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export interface AdminOrderRow {
  id: string;
  code: string;
  userName: string;
  date: string;
  status: AdminOrderStatus;
  items: number;
  total: number;
  method: string; // método del último pago (enum EN)
}

export interface AdminOrderDetail {
  id: string;
  code: string;
  date: string;
  status: AdminOrderStatus;
  total: number;
  method: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  lines: {
    id: string;
    name: string;
    brand: string;
    variantName: string | null;
    qty: number;
    unitPrice: number;
    category: CategorySlug | null;
  }[];
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  emailsSent: number;
}

const orderInclude = {
  items: { include: { product: { select: { categorySlug: true } } } },
  payments: { orderBy: { createdAt: "desc" as const }, take: 1 },
  user: { select: { name: true, email: true } },
  _count: { select: { emails: true } },
};

export async function listAdminOrders(
  status?: AdminOrderStatus,
): Promise<AdminOrderRow[]> {
  await requireAdmin();
  const rows = await prisma.order.findMany({
    where: status ? { status } : undefined,
    include: {
      items: { select: { qty: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((o) => ({
    id: o.id,
    code: o.code,
    userName: o.user?.name ?? o.shippingName,
    date: o.createdAt.toISOString().slice(0, 10),
    status: o.status as AdminOrderStatus,
    items: o.items.reduce((s, i) => s + i.qty, 0),
    total: Number(o.total),
    method: o.payments[0]?.method ?? "CARD",
  }));
}

export async function getAdminOrder(id: string): Promise<AdminOrderDetail | null> {
  await requireAdmin();
  const o = await prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });
  if (!o) return null;
  return {
    id: o.id,
    code: o.code,
    date: o.createdAt.toISOString().slice(0, 10),
    status: o.status as AdminOrderStatus,
    total: Number(o.total),
    method: o.payments[0]?.method ?? "CARD",
    customer: {
      name: o.shippingName,
      email: o.email,
      phone: o.phone,
      street: o.street,
      city: o.city,
      state: o.state,
      zip: o.zip,
      country: o.country,
    },
    lines: o.items.map((i) => ({
      id: i.id,
      name: i.name,
      brand: i.brand,
      variantName: i.variantName,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
      category: (i.product?.categorySlug as CategorySlug) ?? null,
    })),
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    emailsSent: o._count.emails,
  };
}

export interface OrderUpdateInput {
  status?: AdminOrderStatus;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}

export async function updateAdminOrder(
  id: string,
  input: OrderUpdateInput,
): Promise<AdminOrderDetail> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  const firstTimeShipped = await prisma.$transaction(async (tx) => {
    const found = await tx.order.findUnique({ where: { id, storeId }, select: { id: true } });
    if (!found) throw new ApiError(404, "Pedido no encontrado");
    await tx.order.update({ where: { id, storeId }, data: { updatedAt: new Date() } });
    const existing = await tx.order.findUniqueOrThrow({ where: { id, storeId } });
    if ((existing.status === "CANCELLED" || existing.inventoryRestoredAt) && input.status && input.status !== "CANCELLED") {
      throw new ApiError(409, "El inventario de este pedido fue liberado; no se puede reactivar");
    }
    const statusChanged = input.status && input.status !== existing.status;
    const firstTimeShipped = input.status === "SHIPPED" && !existing.shippedAt;
    if (input.status === "CANCELLED" && existing.status !== "CANCELLED") await restockOrderOnce(id, tx);
    await tx.order.update({
      where: { id, storeId },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.carrier !== undefined ? { carrier: input.carrier } : {}),
        ...(input.trackingNumber !== undefined ? { trackingNumber: input.trackingNumber } : {}),
        ...(input.trackingUrl !== undefined ? { trackingUrl: input.trackingUrl } : {}),
        ...(firstTimeShipped ? { shippedAt: new Date() } : {}),
        ...(input.status === "DELIVERED" && !existing.deliveredAt ? { deliveredAt: new Date() } : {}),
      },
    });
    if (statusChanged) await tx.orderStatusEvent.create({ data: { storeId, orderId: id, status: input.status! } });
    if (input.status === "DELIVERED" && existing.status !== "DELIVERED") {
      await tx.payment.updateMany({
        where: { storeId, orderId: id, method: "COD", status: "PENDING" }, data: { status: "COMPLETED" },
      });
    }
    return firstTimeShipped;
  }, { isolationLevel: "ReadCommitted", timeout: 15000 });

  // Fuera de la escritura principal y sin esperar a que falle: el estado ya
  // cambió, el correo es un aviso adicional (igual que las notificaciones del
  // checkout en orders.ts).
  if (firstTimeShipped) await sendOrderShippedEmail(id);

  return (await getAdminOrder(id))!;
}

/**
 * Envío manual desde el botón del panel. A diferencia de los automáticos, si
 * falla SÍ se avisa al admin (502) para que pueda reintentar.
 */
export async function sendOrderEmail(
  id: string,
  includeTracking: boolean,
): Promise<{ to: string; sentAt: string }> {
  await requireAdmin();
  const result = await sendOrderEmailManual(id, includeTracking);
  if (result === "not_found") throw new ApiError(404, "Pedido no encontrado");
  if (!result) {
    throw new ApiError(
      502,
      "No se pudo enviar el correo. Revisa la configuración de correo (SMTP) en el servidor.",
    );
  }
  return { to: result.to, sentAt: result.sentAt.toISOString() };
}

export interface VerifyPaymentResult {
  /** Cuántas transacciones tiene Wompi para este pedido. */
  found: number;
  /** Estado de la transacción que se aplicó (APPROVED, DECLINED…), o null si no había ninguna. */
  transactionStatus: string | null;
  /** Estado del pedido DESPUÉS de conciliar. */
  orderStatus: string;
  /** `true` si la conciliación cambió algo (antes ≠ después). */
  changed: boolean;
}

/**
 * Concilia un pedido contra Wompi desde el panel ("Verificar pago con Wompi").
 *
 * Tercera vía, para cuando fallan las dos automáticas: el webhook no entró
 * (servidor caído, túnel muerto, deploy en curso) y el cliente nunca volvió a
 * la página de retorno. Sin esto, un pedido pagado se queda PENDING para
 * siempre y solo se descubre cuando el cliente reclama.
 *
 * No confía en nada del navegador: le pregunta a Wompi por la referencia (el
 * código del pedido) y delega en `applyWompiTransaction`, la MISMA función
 * idempotente que usan el webhook y la página de retorno — incluida la
 * verificación de que el monto aprobado coincide con el total. Por eso pulsar
 * el botón dos veces no hace daño, y no puede marcar como pagado algo que
 * Wompi no aprobó.
 */
export async function verifyOrderPayment(
  id: string,
): Promise<VerifyPaymentResult> {
  await requireAdmin();

  const order = await prisma.order.findUnique({
    where: { id },
    select: { code: true, status: true, payments: { select: { method: true, gatewayReference: true } } },
  });
  if (!order) throw new ApiError(404, "Pedido no encontrado");

  if (!order.payments.some((p) => p.method === "WOMPI")) {
    throw new ApiError(
      400,
      "Este pedido no se pagó por Wompi: no hay nada que verificar con la pasarela.",
    );
  }
  if (!wompiConfigured()) {
    throw new ApiError(503, "Wompi no está configurado en el servidor.");
  }

  const references = order.payments.filter((payment) => payment.method === "WOMPI" && payment.gatewayReference).map((payment) => payment.gatewayReference!);
  const txs = await Promise.all(references.map(fetchWompiTransactionsByReference)).then((lists) => lists.flat()).catch(() => {
    throw new ApiError(502, "No pudimos consultar a Wompi. Intenta de nuevo.");
  });

  // Si el cliente reintentó, puede haber varias: manda la aprobada. Si ninguna
  // lo está, se aplica la última (la más reciente) para reflejar el rechazo.
  const tx = txs.find((t) => t.status === "APPROVED") ?? txs[txs.length - 1];
  if (!tx) {
    return {
      found: 0,
      transactionStatus: null,
      orderStatus: order.status,
      changed: false,
    };
  }

  const result = await applyWompiTransaction(tx);
  const orderStatus = result?.status ?? order.status;
  return {
    found: txs.length,
    transactionStatus: tx.status,
    orderStatus,
    changed: orderStatus !== order.status,
  };
}

// ---------------------------------------------------------------------------
// Pagos (lista para /admin/payments)
// ---------------------------------------------------------------------------

export interface AdminPaymentRow {
  id: string;
  orderCode: string;
  userName: string;
  method: string;
  amount: number;
  status: string;
  date: string;
}

export async function listAdminPayments(): Promise<AdminPaymentRow[]> {
  await requireAdmin();
  const rows = await prisma.payment.findMany({
    include: {
      order: {
        select: {
          code: true,
          shippingName: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    orderCode: p.order.code,
    userName: p.order.user?.name ?? p.order.shippingName,
    method: p.method,
    amount: Number(p.amount),
    status: p.status,
    date: p.createdAt.toISOString().slice(0, 10),
  }));
}
