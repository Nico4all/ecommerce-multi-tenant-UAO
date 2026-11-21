import "server-only";
import { EMAIL, emailShell, emailButton } from "./email-layout";
import type { Mail } from "./email";
import type { SupportKind } from "./support";
import { KIND_LABEL } from "@/lib/support-form";
import { PAYMENT_METHOD_LABEL } from "@/lib/order-status";
import { commercialPrice, type EmailBranding } from "./commercial-settings";

/**
 * Correos de aviso PARA EL EQUIPO (no para el cliente): lo que entra por
 * Contáctanos, PQR y pedidos nuevos llega también al buzón de la tienda, para
 * no depender de que alguien abra el panel.
 *
 * Funciones puras (no tocan BD ni envían): reciben los datos y devuelven el
 * `Mail`. Quien las dispara y las manda es `store-alerts.ts`.
 *
 * Todos llevan `replyTo` con el correo del cliente: desde Gmail se le contesta
 * directo. Ojo: responder por ahí NO queda registrado en el panel; la respuesta
 * "oficial" de una PQR se sigue guardando en /admin/mensajes.
 */

/** Escapa texto del cliente para incrustarlo en el HTML del correo. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convierte saltos de línea en <br> (después de escapar). */
function toHtml(s: string): string {
  return esc(s).replace(/\r?\n/g, "<br />");
}

/** Filas "Etiqueta: valor" de la ficha de datos. Omite lo que venga vacío. */
function dataRows(rows: [label: string, value: string | null | undefined][]): string {
  return rows
    .filter(([, value]) => !!value)
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:4px 12px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${EMAIL.muted};white-space:nowrap;vertical-align:top">
          ${esc(label)}
        </td>
        <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${EMAIL.text}">
          ${esc(value as string)}
        </td>
      </tr>`,
    )
    .join("");
}

/** Texto plano equivalente a `dataRows`. */
function dataText(rows: [label: string, value: string | null | undefined][]): string {
  return rows
    .filter(([, value]) => !!value)
    .map(([label, value]) => `${label} ${value}`)
    .join("\n");
}

export function buildSupportAlertEmail(opts: {
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
  appUrl: string;
  branding?: EmailBranding;
}): Mail {
  const { id, radicado, kind, name, email, subject, message, appUrl } = opts;
  const esPqr = kind !== "CONTACTO";
  const tipo = KIND_LABEL[kind];
  const titulo = esPqr ? `PQR nueva · ${tipo}` : "Mensaje nuevo de contacto";

  const rows: [string, string | null | undefined][] = [
    ["Radicado", radicado],
    ["Tipo", tipo],
    ["Nombre", name],
    ["Correo", email],
    ["Teléfono", opts.phone],
    ["Documento", opts.docId],
    ["Pedido", opts.orderCode],
  ];

  const content = `
    <tr>
      <td style="padding:16px 32px 4px;text-align:center">
        <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:${EMAIL.text}">
          ${esc(titulo)}
        </h1>
        <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.5px;color:${EMAIL.muted}">
          RADICADO ${esc(radicado)}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${dataRows(rows)}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 32px 0">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.5px;color:${EMAIL.muted}">
          ASUNTO
        </p>
        <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${EMAIL.text}">
          ${esc(subject)}
        </p>
        <div style="border-left:3px solid ${EMAIL.brand};background:#f6faf8;padding:12px 16px;border-radius:0 8px 8px 0">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${EMAIL.text}">
            ${toHtml(message)}
          </p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 32px 4px">
        ${emailButton(`${appUrl}/admin/mensajes/${id}`, "Responder en el panel")}
      </td>
    </tr>`;

  return {
    to: "", // lo completa quien llama
    replyTo: email,
    subject: `[${radicado}] ${tipo} — ${subject}`,
    html: emailShell({
      appUrl,
      branding: opts.branding,
      preheader: `${name}: ${subject}`,
      content,
    }),
    text:
      `${titulo}\n\n` +
      `${dataText(rows)}\n` +
      `Asunto: ${subject}\n\n` +
      `${message}\n\n` +
      `Responder en el panel: ${appUrl}/admin/mensajes/${id}`,
  };
}

export function buildOrderAlertEmail(opts: {
  orderId: string;
  code: string;
  total: number;
  method: string;
  /** `false` mientras el pago siga pendiente de confirmar (Wompi, contra entrega). */
  paid: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  city?: string | null;
  appUrl: string;
  branding?: EmailBranding;
}): Mail {
  const { orderId, code, total, method, paid, customerName, customerEmail, appUrl } =
    opts;
  const metodo = PAYMENT_METHOD_LABEL[method] ?? method;
  const estado = paid ? "Pagado" : "Pendiente de confirmar";
  const formatPrice = (value: number) => commercialPrice(value, opts.branding);

  const rows: [string, string | null | undefined][] = [
    ["Pedido", code],
    ["Total", formatPrice(total)],
    ["Pago", `${metodo} · ${estado}`],
    ["Cliente", customerName],
    ["Correo", customerEmail],
    ["Teléfono", opts.customerPhone],
    ["Ciudad", opts.city],
  ];

  const content = `
    <tr>
      <td style="padding:16px 32px 4px;text-align:center">
        <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:${EMAIL.text}">
          Pedido nuevo ${esc(code)}
        </h1>
        <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.5px;color:${EMAIL.muted}">
          ${esc(formatPrice(total))} · ${esc(estado.toUpperCase())}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${dataRows(rows)}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 32px 4px">
        ${emailButton(`${appUrl}/admin/orders/${orderId}`, "Ver el pedido")}
      </td>
    </tr>`;

  return {
    to: "", // lo completa quien llama
    replyTo: customerEmail,
    subject: `Pedido nuevo ${code} · ${formatPrice(total)}`,
    html: emailShell({
      appUrl,
      branding: opts.branding,
      preheader: `${customerName} — ${metodo}, ${estado.toLowerCase()}.`,
      content,
    }),
    text:
      `Pedido nuevo ${code}\n\n` +
      `${dataText(rows)}\n\n` +
      `Ver el pedido: ${appUrl}/admin/orders/${orderId}`,
  };
}

export function buildLowStockAlertEmail(opts: { productId: string; label: string; stock: number; appUrl: string; branding?: EmailBranding }): Mail {
  const title = opts.stock === 0 ? "Inventario agotado" : "Inventario bajo";
  const link = `${opts.appUrl}/admin/products/${encodeURIComponent(opts.productId)}`;
  return {
    to: "", subject: `${title} — ${opts.label}`,
    html: emailShell({ appUrl: opts.appUrl, branding: opts.branding, preheader: title, content: `<tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif"><h1>${esc(title)}</h1><p>${esc(opts.label)}: ${opts.stock} unidades.</p>${emailButton(link, "Revisar inventario")}</td></tr>` }),
    text: `${title}\n${opts.label}: ${opts.stock} unidades.\n${link}`,
  };
}
