import "server-only";
import { sendEmail } from "./email";
import { prisma, getStoreContext } from "@/lib/prisma";
import { getCommercialSettings, type EmailBranding } from "./commercial-settings";
import {
  buildSupportAlertEmail,
  buildOrderAlertEmail,
  buildLowStockAlertEmail,
} from "./store-alert-email";
import type { SupportKind } from "./support";

/**
 * Avisos por correo al buzón configurado en StoreSettings para esta tienda.
 *
 * Complementan la campana del panel: lo que entra por Contáctanos, PQR o un
 * pedido nuevo también llega al correo del equipo, para enterarse sin tener que
 * abrir /admin.
 *
 * Igual que la campana, son "best effort" y NUNCA lanzan: un aviso caído no
 * puede tumbar la PQR ni la venta que lo originó. El fallback STORE_EMAIL /
 * SMTP_USER se conserva exclusivamente para la tienda original.
 */

/** Manda el correo al buzón interno y registra (sin lanzar) si no salió. */
async function deliver(
  build: (appUrl: string, branding: EmailBranding) => Parameters<typeof sendEmail>[0],
  what: string,
): Promise<void> {
  try {
    const { notificationEmail: to, branding } = await getCommercialSettings();
    if (!to) {
      console.warn(`[store-alerts] sin buzón de tienda: no se avisó de ${what}`);
      return;
    }
    const { sent } = await sendEmail({ ...build(branding.origin, branding), to });
    if (!sent) console.warn(`[store-alerts] aviso de ${what} no enviado`);
  } catch {
    console.warn("[store-alerts] aviso no disponible");
  }
}

export async function alertStoreSupportMessage(m: {
  id: string;
  radicado: string;
  kind: SupportKind;
  name: string;
  email: string;
  phone?: string | null;
  docId?: string | null;
  orderCode?: string | null;
  subject: string;
  message: string;
}): Promise<void> {
  try {
    const { id: storeId } = await getStoreContext();
    const message = await prisma.supportMessage.findUnique({ where: { id: m.id, storeId } });
    if (!message) return;
    await deliver(
      (base, branding) => buildSupportAlertEmail({ ...message, kind: message.kind as SupportKind, appUrl: base, branding }),
      m.radicado,
    );
  } catch { console.warn("[store-alerts] aviso de contacto no disponible"); }
}

export async function alertStoreOrderCreated(o: {
  orderId: string;
  code: string;
  total: number;
  method: string;
  paid: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  city?: string | null;
}): Promise<void> {
  try {
    const { id: storeId } = await getStoreContext();
    const order = await prisma.order.findUnique({ where: { id: o.orderId, storeId }, include: { payments: { where: { storeId }, orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!order) return;
    const payment = order.payments[0];
    await deliver(
      (base, branding) => buildOrderAlertEmail({ orderId: order.id, code: order.code, total: Number(order.total), method: payment?.method ?? o.method, paid: payment?.status === "COMPLETED", customerName: order.shippingName, customerEmail: order.email, customerPhone: order.phone, city: order.city, appUrl: base, branding }),
      `el pedido ${o.code}`,
    );
  } catch { console.warn("[store-alerts] aviso de pedido no disponible"); }
}

export async function alertStoreLowStock(entityId: string, isVariant: boolean): Promise<void> {
  try {
    const { id: storeId } = await getStoreContext();
    const row = isVariant
      ? await prisma.productVariant.findUnique({ where: { id: entityId, storeId }, include: { product: true } })
      : await prisma.product.findUnique({ where: { id: entityId, storeId } });
    if (!row) return;
    const productId = "productId" in row ? row.productId : row.id;
    const label = "product" in row ? `${row.product.name} · ${row.name}` : row.name;
    await deliver((appUrl, branding) => buildLowStockAlertEmail({ productId, label, stock: row.stock, appUrl, branding }), "inventario bajo");
  } catch { console.warn("[store-alerts] aviso de inventario no disponible"); }
}
