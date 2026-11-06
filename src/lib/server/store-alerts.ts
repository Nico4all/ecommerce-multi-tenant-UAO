import "server-only";
import { sendEmail, storeEmail } from "./email";
import {
  buildSupportAlertEmail,
  buildOrderAlertEmail,
} from "./store-alert-email";
import type { SupportKind } from "./support";

/**
 * Avisos por correo al buzón de la tienda (`STORE_EMAIL`).
 *
 * Complementan la campana del panel: lo que entra por Contáctanos, PQR o un
 * pedido nuevo también llega al correo del equipo, para enterarse sin tener que
 * abrir /admin.
 *
 * Igual que la campana, son "best effort" y NUNCA lanzan: un aviso caído no
 * puede tumbar la PQR ni la venta que lo originó. Si no hay `STORE_EMAIL` ni
 * `SMTP_USER` configurados, simplemente no se avisa.
 */

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

/** Manda el correo al buzón interno y registra (sin lanzar) si no salió. */
async function deliver(
  build: (appUrl: string) => Parameters<typeof sendEmail>[0],
  what: string,
): Promise<void> {
  try {
    const to = storeEmail();
    if (!to) {
      console.warn(`[store-alerts] sin STORE_EMAIL: no se avisó de ${what}`);
      return;
    }
    const { sent } = await sendEmail({ ...build(appUrl()), to });
    if (!sent) console.warn(`[store-alerts] aviso de ${what} no enviado`);
  } catch (e) {
    console.error(`[store-alerts] no se pudo avisar de ${what}:`, e);
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
  await deliver(
    (base) => buildSupportAlertEmail({ ...m, appUrl: base }),
    m.radicado,
  );
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
  await deliver(
    (base) => buildOrderAlertEmail({ ...o, appUrl: base }),
    `el pedido ${o.code}`,
  );
}
