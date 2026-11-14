import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { sendEmail } from "./email";
import { buildOrderEmail, type OrderEmailInput } from "./order-email";
import { getCommercialSettings } from "./commercial-settings";
import { assertImageReferences } from "./storage";

/**
 * Envío de correos de pedido, compartido por los tres disparadores:
 *   - automático al crear el pedido (checkout)
 *   - automático la primera vez que pasa a "Enviado"
 *   - manual, desde el botón del panel de administración
 *
 * Los dos automáticos son "best effort": si el correo falla (proveedor caído,
 * sin configurar…) NO debe tumbar el checkout ni el cambio de estado — la
 * venta y la logística ya pasaron, son hechos consumados. El botón manual del
 * admin sí necesita saber si falló (para poder avisar y reintentar), así que
 * ese caso lo maneja `sendOrderEmail` en `admin/orders.ts`, que sí relanza el
 * error.
 */

const orderForEmailInclude = {
  items: {
    include: {
      product: {
        include: { images: { where: { isPrimary: true }, take: 1 } },
      },
    },
  },
} as const;

type OrderForEmail = NonNullable<
  Awaited<ReturnType<typeof fetchOrderForEmail>>
>;

async function fetchOrderForEmail(orderId: string) {
  const { id: storeId } = await getStoreContext();
  return prisma.order.findUnique({
    where: { id: orderId, storeId },
    include: { ...orderForEmailInclude, items: { where: { storeId }, include: orderForEmailInclude.items.include } },
  });
}

/**
 * Arma y manda el correo; si se envió, registra el EmailLog.
 * Devuelve la fecha de envío (del log) o `null` si no se pudo enviar.
 */
async function deliverOrderEmail(
  order: OrderForEmail,
  kind: OrderEmailInput["kind"],
  trackingUrl: string | null,
  sender = sendEmail,
): Promise<Date | null> {
  const base = (await getStoreContext()).origin;
  const { branding } = await getCommercialSettings();
  if (order.storeId !== branding.storeId) return null;
  const items = await Promise.all(order.items.map(async (item) => {
    let imageUrl: string | null = null;
    const image = item.product?.images[0]?.url;
    if (image) {
      try { await assertImageReferences([image]); imageUrl = new URL(image, base).href; } catch { /* Omitir referencias ajenas o inválidas. */ }
    }
    return { name: item.name, brand: item.brand, variantName: item.variantName, qty: item.qty, unitPrice: Number(item.unitPrice), imageUrl };
  }));
  let safeTracking: string | null = null;
  try {
    const url = trackingUrl ? new URL(trackingUrl) : null;
    if (url && ["https:", "http:"].includes(url.protocol) && !url.username && !url.password) safeTracking = url.href;
  } catch { /* No emitir enlaces de seguimiento inválidos. */ }
  const mail = buildOrderEmail({
    code: order.code,
    shippingName: order.shippingName,
    street: order.street,
    city: order.city,
    state: order.state,
    zip: order.zip,
    country: order.country,
    total: Number(order.total),
    kind,
    trackingUrl: safeTracking,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    appUrl: base,
    branding, items,
  });

  const { sent } = await sender({ ...mail, to: order.email });
  if (!sent) return null;

  const log = await prisma.emailLog.create({
    data: {
      storeId: order.storeId,
      orderId: order.id,
      userId: order.userId,
      to: order.email,
      type: kind === "shipping" ? "SHIPPING_UPDATE" : "ORDER_CONFIRMATION",
      includedTracking: !!safeTracking,
    },
  });
  return log.sentAt;
}

/**
 * Confirmación automática al crear el pedido. Best-effort: un fallo de correo
 * no debe deshacer ni bloquear el checkout (la orden ya se creó de verdad).
 */
export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  try {
    const order = await fetchOrderForEmail(orderId);
    if (!order) return;
    const sent = await deliverOrderEmail(order, "confirmation", null);
    if (!sent) {
      console.warn(`[order-email] confirmación no enviada para pedido ${order.code}`);
    }
  } catch { console.warn("[order-email] confirmación no disponible"); }
}

/**
 * Aviso de envío automático, la primera vez que el pedido pasa a "Enviado".
 * Best-effort por la misma razón: el estado ya cambió, no se revierte por esto.
 */
export async function sendOrderShippedEmail(orderId: string): Promise<void> {
  try {
    const order = await fetchOrderForEmail(orderId);
    if (!order) return;
    const sent = await deliverOrderEmail(order, "shipping", order.trackingUrl);
    if (!sent) {
      console.warn(`[order-email] aviso de envío no enviado para pedido ${order.code}`);
    }
  } catch { console.warn("[order-email] aviso de envío no disponible"); }
}

/**
 * Envío manual desde el panel. A diferencia de los automáticos, SÍ importa que
 * el llamador sepa si falló (el admin ve un error y puede reintentar).
 */
export function createManualOrderEmailSender(sender = sendEmail) {
  return async function sendOrderEmailManual(
    orderId: string,
    includeTracking: boolean,
  ): Promise<{ to: string; sentAt: Date } | null | "not_found"> {
    const order = await fetchOrderForEmail(orderId);
    if (!order) return "not_found";
    const tracking = includeTracking && !!order.trackingUrl;
    const sentAt = await deliverOrderEmail(
      order,
      tracking ? "shipping" : "confirmation",
      tracking ? order.trackingUrl : null,
      sender,
    );
    return sentAt ? { to: order.email, sentAt } : null;
  };
}

export const sendOrderEmailManual = createManualOrderEmailSender();
