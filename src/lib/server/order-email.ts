import "server-only";
import { commercialPrice, type EmailBranding } from "./commercial-settings";
import type { Mail } from "./email";
import { EMAIL, emailShell, emailButton, escapeEmailHtml as esc } from "./email-layout";

/**
 * Plantilla del correo de pedido (confirmación / envío), estilo "recibo de
 * tienda" —logo de marca, titular, número de pedido, dirección y artículos—
 * como los que mandan Zara, Amazon, etc. Reutiliza la tarjeta y el botón de
 * marca de `email-layout.ts`.
 */

const { brand: BRAND, text: TEXT, muted: MUTED, border: BORDER } = EMAIL;

export interface OrderEmailItem {
  name: string;
  brand: string;
  variantName: string | null;
  qty: number;
  unitPrice: number;
  /** URL pública absoluta de la foto, si el producto sigue existiendo. */
  imageUrl: string | null;
}

export interface OrderEmailInput {
  code: string;
  shippingName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  items: OrderEmailItem[];
  total: number;
  /**
   * Qué correo es: define el titular y el asunto.
   *   "confirmation" -> se acaba de crear el pedido.
   *   "shipping"     -> el pedido pasó a "Enviado".
   */
  kind: "confirmation" | "shipping";
  /** Botón de rastreo: se muestra solo si ya hay enlace (puede faltar aún en "shipping"). */
  trackingUrl: string | null;
  /** Transportadora y guía: se muestran como texto aunque no haya enlace. */
  carrier?: string | null;
  trackingNumber?: string | null;
  /** Base pública de la tienda, para el enlace "Ver mi pedido" y las fotos. */
  appUrl: string;
  branding?: EmailBranding;
}

function itemRow(item: OrderEmailItem, branding?: EmailBranding): string {
  const variant = item.variantName ? ` · ${item.variantName}` : "";
  const img = item.imageUrl
    ? `<img src="${esc(item.imageUrl)}" width="64" height="64" alt="" style="display:block;border-radius:6px;border:1px solid ${BORDER};object-fit:cover" />`
    : `<div style="width:64px;height:64px;border-radius:6px;background:#f3f4f6"></div>`;

  return `
    <tr>
      <td style="padding:12px 0;border-top:1px solid ${BORDER}" width="64">${img}</td>
      <td style="padding:12px 0 12px 12px;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif">
        <p style="margin:0;font-size:14px;color:${TEXT};font-weight:600">${esc(item.name)}</p>
        <p style="margin:2px 0 0;font-size:12px;color:${MUTED}">${esc(item.brand)}${esc(variant)} · Cant. ${item.qty}</p>
      </td>
      <td style="padding:12px 0;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT};text-align:right;white-space:nowrap" valign="top">
        ${commercialPrice(item.unitPrice * item.qty, branding)}
      </td>
    </tr>`;
}

export function buildOrderEmail(input: OrderEmailInput): Mail {
  const formatPrice = (value: number) => commercialPrice(value, input.branding);
  const isShipping = input.kind === "shipping";
  const headline = isShipping ? "Tu pedido está en camino" : "Recibimos tu pedido";
  const intro = isShipping
    ? "Buenas noticias: tu paquete ya salió. En breve lo tendrás en tus manos."
    : "Gracias por tu compra. Te avisaremos cuando tu pedido esté en camino.";
  const orderUrl = `${input.appUrl}/orders/${encodeURIComponent(input.code)}`;

  const itemsHtml = input.items.map((item) => itemRow(item, input.branding)).join("");

  // Datos del envío: se muestran con lo que haya, aunque falte el enlace.
  const shipInfo =
    input.carrier || input.trackingNumber
      ? `${input.carrier ?? "Envío"}${
          input.trackingNumber ? ` · Guía ${input.trackingNumber}` : ""
        }`
      : "";
  const shipInfoHtml = shipInfo
    ? `<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${TEXT}">${esc(shipInfo)}</p>`
    : "";

  const trackingButton = input.trackingUrl
    ? `<div style="height:20px;line-height:20px">&nbsp;</div>${emailButton(input.trackingUrl, "HAZ SEGUIMIENTO AQUÍ")}`
    : "";

  const content = `
    <tr>
      <td style="padding:16px 32px 4px;text-align:center">
        <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:${TEXT}">
          ${headline}
        </h1>
        <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.5px;color:${MUTED}">
          PEDIDO N.º ${esc(input.code)}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 32px 0;text-align:center">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED}">
          ${intro}
        </p>
        ${shipInfoHtml}
        ${trackingButton}
      </td>
    </tr>

    <tr>
      <td style="padding:28px 32px 0">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.5px;color:${MUTED}">
          ENVÍO A DOMICILIO
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${TEXT}">
          ${esc(input.shippingName)}<br />
          ${esc(input.street)}<br />
          ${esc(input.city)}, ${esc(input.state)}${input.zip ? ` ${esc(input.zip)}` : ""}<br />
          ${esc(input.country)}
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 32px 0">
        <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.5px;color:${MUTED}">
          ${input.items.length} ARTÍCULO${input.items.length === 1 ? "" : "S"}
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${itemsHtml}
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">
          <tr>
            <td style="padding:12px 0 0;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${TEXT}">
              Total
            </td>
            <td style="padding:12px 0 0;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${TEXT};text-align:right">
              ${formatPrice(input.total)}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:28px 32px 32px;text-align:center">
        <a href="${esc(orderUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND};text-decoration:underline">
          Ver el detalle de mi pedido
        </a>
      </td>
    </tr>`;

  const html = emailShell({ appUrl: input.appUrl, branding: input.branding, preheader: intro, content });

  const textLines = [
    headline.toUpperCase(),
    `Pedido N.º ${input.code}`,
    "",
    intro,
    "",
    "Envío a domicilio:",
    input.shippingName,
    input.street,
    `${input.city}, ${input.state}${input.zip ? ` ${input.zip}` : ""}`,
    input.country,
    "",
    `${input.items.length} artículo(s):`,
    ...input.items.map(
      (i) =>
        `  ${i.qty}x ${i.name}${i.variantName ? ` (${i.variantName})` : ""} — ${formatPrice(i.unitPrice * i.qty)}`,
    ),
    "",
    `Total: ${formatPrice(input.total)}`,
    "",
    ...(shipInfo ? [shipInfo, ""] : []),
    ...(input.trackingUrl ? [`Rastrea tu pedido: ${input.trackingUrl}`, ""] : []),
    `Ver el pedido: ${orderUrl}`,
  ];

  return {
    to: "", // lo completa quien llama
    subject: isShipping
      ? `Tu pedido ${input.code} está en camino`
      : `Recibimos tu pedido ${input.code}`,
    html,
    text: textLines.join("\n"),
  };
}
