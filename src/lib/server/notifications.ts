import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth";
import { ApiError } from "./api-helpers";
import { formatPrice } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/order-status";

/**
 * Avisos de la campana del panel.
 *
 * Los `notifyX` los llaman los servicios de la tienda (checkout, PQR, reseñas)
 * y NO llevan `requireAdmin`: los dispara un cliente, los lee el equipo.
 * Tampoco lanzan nunca: un aviso no puede tumbar la venta que lo originó.
 *
 * Las funciones de lectura sí exigen admin.
 */

export type NotificationType =
  | "ORDER_CREATED"
  | "SUPPORT_MESSAGE"
  | "REVIEW_CREATED"
  | "LOW_STOCK";

/** A partir de aquí un producto se considera con stock bajo. */
export const LOW_STOCK_THRESHOLD = 5;

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  entityId?: string | null;
}

/** Crea el aviso. Si falla, lo registra y sigue: nunca propaga el error. */
async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        entityId: input.entityId ?? null,
      },
    });
  } catch (e) {
    console.error("[notifications] no se pudo crear el aviso:", e);
  }
}

// ───────────────────────── Disparadores ─────────────────────────

export async function notifyOrderCreated(o: {
  orderId: string;
  code: string;
  total: number;
  paid: boolean;
  method: string;
  customerName: string;
}): Promise<void> {
  const method = PAYMENT_METHOD_LABEL[o.method] ?? o.method;
  await notify({
    type: "ORDER_CREATED",
    entityId: o.orderId,
    href: `/admin/orders/${o.orderId}`,
    title: `Pedido nuevo ${o.code} · ${formatPrice(o.total)}`,
    body: o.paid
      ? `${o.customerName} pagó con ${method}.`
      : `${o.customerName} eligió ${method}: el pago queda pendiente de confirmar.`,
  });
}

export async function notifySupportMessage(m: {
  id: string;
  radicado: string;
  kind: string;
  name: string;
  subject: string;
}): Promise<void> {
  const esPqr = m.kind !== "CONTACTO";
  await notify({
    type: "SUPPORT_MESSAGE",
    entityId: m.id,
    href: `/admin/mensajes/${m.id}`,
    title: esPqr
      ? `PQR nueva ${m.radicado}`
      : `Mensaje nuevo de ${m.name}`,
    body: esPqr ? `${m.name}: ${m.subject}` : m.subject,
  });
}

export async function notifyReviewCreated(r: {
  productId: string;
  productName: string;
  rating: number;
  userName: string;
}): Promise<void> {
  await notify({
    type: "REVIEW_CREATED",
    entityId: r.productId,
    href: `/admin/products/${r.productId}`,
    title: `Reseña de ${r.rating}★ en ${r.productName}`,
    body: `${r.userName} calificó el producto.`,
  });
}

/** Un aviso por entidad mientras siga sin leerse, para no repetir lo mismo. */
async function lowStockOnce(
  entityId: string,
  label: string,
  stock: number,
  href: string,
): Promise<void> {
  const pending = await prisma.notification.findFirst({
    where: { type: "LOW_STOCK", entityId, readAt: null },
    select: { id: true },
  });
  if (pending) return;

  await notify({
    type: "LOW_STOCK",
    entityId,
    href,
    title: stock === 0 ? `Se agotó ${label}` : `Queda poco stock de ${label}`,
    body:
      stock === 0
        ? "No quedan unidades. Repón el inventario o ocúltalo de la tienda."
        : `Quedan ${stock} unidad${stock === 1 ? "" : "es"}.`,
  });
}

/**
 * Revisa, tras una venta, si alguna de las líneas dejó el inventario bajo.
 * Se llama DESPUÉS de la transacción del checkout, con el stock ya descontado.
 */
export async function notifyLowStockAfterSale(
  lines: { productId: string; variantId: string | null }[],
): Promise<void> {
  try {
    const productIds = lines.filter((l) => !l.variantId).map((l) => l.productId);
    const variantIds = lines
      .map((l) => l.variantId)
      .filter((v): v is string => !!v);

    if (productIds.length) {
      const rows = await prisma.product.findMany({
        where: { id: { in: productIds }, stock: { lte: LOW_STOCK_THRESHOLD } },
        select: { id: true, name: true, stock: true },
      });
      for (const p of rows) {
        await lowStockOnce(p.id, p.name, p.stock, `/admin/products/${p.id}`);
      }
    }

    if (variantIds.length) {
      const rows = await prisma.productVariant.findMany({
        where: { id: { in: variantIds }, stock: { lte: LOW_STOCK_THRESHOLD } },
        select: {
          id: true,
          name: true,
          stock: true,
          product: { select: { id: true, name: true } },
        },
      });
      for (const v of rows) {
        await lowStockOnce(
          v.id,
          `${v.product.name} · ${v.name}`,
          v.stock,
          `/admin/products/${v.product.id}`,
        );
      }
    }
  } catch (e) {
    console.error("[notifications] no se pudo revisar el stock bajo:", e);
  }
}

// ───────────────────────── Lectura (solo admin) ─────────────────────────

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

function toDTO(n: Row): NotificationDTO {
  return {
    id: n.id,
    type: n.type as NotificationType,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

export interface NotificationFeed {
  items: NotificationDTO[];
  unread: number;
}

export async function getNotificationFeed(limit = 15): Promise<NotificationFeed> {
  await requireAdmin();
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
    prisma.notification.count({ where: { readAt: null } }),
  ]);
  return { items: rows.map(toDTO), unread };
}

export async function markNotificationRead(id: string): Promise<void> {
  await requireAdmin();
  const updated = await prisma.notification
    .update({ where: { id }, data: { readAt: new Date() } })
    .catch(() => null);
  if (!updated) throw new ApiError(404, "Aviso no encontrado");
}

/** Devuelve cuántas quedaron marcadas, para poder confirmarlo en la UI. */
export async function markAllNotificationsRead(): Promise<number> {
  await requireAdmin();
  const { count } = await prisma.notification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}
