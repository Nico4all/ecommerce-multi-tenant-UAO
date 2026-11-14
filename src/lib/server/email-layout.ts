import "server-only";
import type { EmailBranding } from "./commercial-settings";
import { currentStoreContext } from "./store-context";

export const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function emailIdentity(appUrl: string, branding?: EmailBranding) {
  const context = currentStoreContext();
  const origin = branding?.origin ?? context?.origin;
  const name = branding?.name ?? context?.name;
  if (!origin || !name || new URL(appUrl).origin !== origin || (context && branding && context.id !== branding.storeId)) throw new Error("Identidad de correo inválida");
  return { origin, name, logoUrl: branding?.logoUrl ?? null };
}

/**
 * Piezas compartidas de los correos (logo, botón, tarjeta de marca).
 *
 * HTML "a la vieja usanza" (tablas + estilos inline): es lo único que se ve
 * igual en Gmail, Outlook y el resto de clientes, que ignoran <style> y CSS
 * moderno. El logo es un PNG servido desde `public/` (los clientes de correo no
 * renderizan SVG); si el destinatario no puede cargarlo —p.ej. en local, donde
 * `APP_URL` apunta a localhost— el `alt` muestra el nombre de la marca.
 */

export const EMAIL = {
  brand: "#008856",
  text: "#111111",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f4f4f5",
};

function logoHeader(identity: ReturnType<typeof emailIdentity>): string {
  if (!identity.logoUrl) return `<tr><td style="padding:28px 32px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-weight:bold">${escapeEmailHtml(identity.name)}</td></tr>`;
  return `
    <tr>
      <td style="padding:28px 32px 10px;text-align:center">
        <img src="${escapeEmailHtml(identity.logoUrl)}" width="230" alt="${escapeEmailHtml(identity.name)}"
             style="display:block;margin:0 auto;width:230px;max-width:70%;height:auto;border:0" />
      </td>
    </tr>`;
}

/** Botón principal de marca (call-to-action), centrado. */
export function emailButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto">
      <tr>
        <td style="border-radius:8px;background:${EMAIL.brand}">
          <a href="${escapeEmailHtml(href)}" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px">${escapeEmailHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

/**
 * Envuelve `content` (filas `<tr>` de una tabla) en la tarjeta de marca: logo
 * arriba y pie con ayuda/copyright. El `preheader` es el texto de vista previa
 * que muestran algunos clientes en la bandeja (oculto en el cuerpo).
 */
export function emailShell(opts: {
  appUrl: string;
  content: string;
  preheader?: string;
  branding?: EmailBranding;
}): string {
  const { appUrl, content, preheader = "" } = opts;
  const identity = emailIdentity(appUrl, opts.branding);
  const base = escapeEmailHtml(identity.origin);
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:${EMAIL.bg}">
    ${
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeEmailHtml(preheader)}</div>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL.bg};padding:24px 0">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;max-width:600px;width:100%">
            ${logoHeader(identity)}
            ${content}
            <tr>
              <td style="padding:22px 32px;border-top:1px solid ${EMAIL.border};text-align:center">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${EMAIL.muted}">
                  ¿Necesitas ayuda? Escríbenos desde
                  <a href="${base}/contacto" style="color:${EMAIL.brand};text-decoration:underline">nuestro centro de contacto</a>.
                </p>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${EMAIL.muted}">
                  © ${new Date().getFullYear()} ${escapeEmailHtml(identity.name)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
