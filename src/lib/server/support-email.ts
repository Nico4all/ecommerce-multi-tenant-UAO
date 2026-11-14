import "server-only";
import { EMAIL, emailShell, emailButton } from "./email-layout";
import type { Mail } from "./email";
import type { EmailBranding } from "./commercial-settings";
import type { SupportKind } from "./support";

/**
 * Correo con la respuesta del equipo a una PQR o mensaje de contacto.
 *
 * Función pura (no toca BD ni envía): recibe los datos y devuelve el `Mail`.
 * Lo dispara `updateSupportMessage` cuando el admin guarda una respuesta.
 */

/** Escapa texto del usuario/admin para incrustarlo en el HTML del correo. */
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

export function buildSupportReplyEmail(opts: {
  name: string;
  radicado: string;
  kind: SupportKind;
  subject: string;
  /** Lo que escribió el cliente originalmente. */
  originalMessage: string;
  /** La respuesta del equipo. */
  response: string;
  appUrl: string;
  branding?: EmailBranding;
}): Mail {
  const { name, radicado, kind, subject, originalMessage, response, appUrl } = opts;
  const nombre = name.split(" ")[0] || name;
  const esPqr = kind !== "CONTACTO";
  const tipo = esPqr ? "tu PQR" : "tu mensaje";

  const content = `
    <tr>
      <td style="padding:16px 32px 4px;text-align:center">
        <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:${EMAIL.text}">
          Respondimos ${tipo}
        </h1>
        <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.5px;color:${EMAIL.muted}">
          RADICADO ${esc(radicado)}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 32px 0">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${EMAIL.muted}">
          Hola ${esc(nombre)}, respondimos ${tipo} sobre
          &ldquo;${esc(subject)}&rdquo;:
        </p>
        <div style="margin:14px 0 0;border-left:3px solid ${EMAIL.brand};background:#f6faf8;padding:12px 16px;border-radius:0 8px 8px 0">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${EMAIL.text}">
            ${toHtml(response)}
          </p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 32px 4px">
        <div style="border-top:1px solid ${EMAIL.border};padding-top:16px">
          <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.5px;color:${EMAIL.muted}">
            TU MENSAJE ORIGINAL
          </p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${EMAIL.muted}">
            ${toHtml(originalMessage)}
          </p>
        </div>
        <div style="height:20px;line-height:20px">&nbsp;</div>
        ${emailButton(`${appUrl}/contacto`, "Escribirnos de nuevo")}
      </td>
    </tr>`;

  return {
    to: "", // lo completa quien llama
    subject: `Respuesta a ${radicado} — ${subject}`,
    html: emailShell({
      appUrl,
      branding: opts.branding,
      preheader: `Respondimos ${tipo} (${radicado}).`,
      content,
    }),
    text:
      `Hola ${nombre},\n\n` +
      `Respondimos ${tipo} "${subject}" (radicado ${radicado}):\n\n` +
      `${response}\n\n` +
      `--- Tu mensaje original ---\n${originalMessage}\n\n` +
      `Si necesitas algo más, escríbenos desde ${appUrl}/contacto`,
  };
}
