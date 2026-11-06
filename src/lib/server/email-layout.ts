import "server-only";

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

function logoHeader(appUrl: string): string {
  return `
    <tr>
      <td style="padding:28px 32px 10px;text-align:center">
        <img src="${appUrl}/email-logo.png" width="230" alt="Variedades Los Primos"
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
          <a href="${href}" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px">${label}</a>
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
}): string {
  const { appUrl, content, preheader = "" } = opts;
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:${EMAIL.bg}">
    ${
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL.bg};padding:24px 0">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;max-width:600px;width:100%">
            ${logoHeader(appUrl)}
            ${content}
            <tr>
              <td style="padding:22px 32px;border-top:1px solid ${EMAIL.border};text-align:center">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${EMAIL.muted}">
                  ¿Necesitas ayuda? Escríbenos desde
                  <a href="${appUrl}/contacto" style="color:${EMAIL.brand};text-decoration:underline">nuestro centro de contacto</a>.
                </p>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${EMAIL.muted}">
                  © ${new Date().getFullYear()} Variedades Los Primos
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
