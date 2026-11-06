import "server-only";
import { EMAIL, emailShell, emailButton } from "./email-layout";
import type { Mail } from "./email";

/**
 * Correos de autenticación (por ahora, recuperación de contraseña).
 *
 * Función pura (no toca BD): recibe los datos ya resueltos y devuelve el `Mail`.
 * Así se puede previsualizar/probar sin base de datos, y `password-reset.ts`
 * solo se encarga del token y del envío.
 */

export function buildPasswordResetEmail(opts: {
  nombre: string;
  /** Enlace absoluto a /restablecer?token=… */
  link: string;
  /** Base pública, para el logo y el pie de la plantilla. */
  appUrl: string;
}): Mail {
  const { nombre, link, appUrl } = opts;

  const content = `
    <tr>
      <td style="padding:16px 32px 4px;text-align:center">
        <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:${EMAIL.text}">
          Restablece tu contraseña
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 32px 0;text-align:center">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${EMAIL.muted}">
          Hola ${nombre}, recibimos una solicitud para restablecer la contraseña
          de tu cuenta. Toca el botón para elegir una nueva.
        </p>
        <div style="height:22px;line-height:22px">&nbsp;</div>
        ${emailButton(link, "Crear nueva contraseña")}
        <p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${EMAIL.muted}">
          El enlace vence en <strong>1 hora</strong>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px 4px">
        <div style="border-top:1px solid ${EMAIL.border};padding-top:16px">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${EMAIL.muted}">
            Si no pediste el cambio, ignora este correo: tu contraseña no cambia.
            Si el botón no funciona, copia y pega esta dirección en tu navegador:
          </p>
          <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;word-break:break-all;color:${EMAIL.brand}">
            ${link}
          </p>
        </div>
      </td>
    </tr>`;

  return {
    to: "", // lo completa quien llama
    subject: "Restablece tu contraseña — Variedades Los Primos",
    html: emailShell({
      appUrl,
      preheader: "Restablece la contraseña de tu cuenta (enlace válido por 1 hora).",
      content,
    }),
    text:
      `Hola ${nombre},\n\n` +
      `Recibimos una solicitud para restablecer tu contraseña. Abre este enlace ` +
      `(válido por 1 hora) para elegir una nueva:\n\n${link}\n\n` +
      `Si no lo pediste, ignora este correo: tu contraseña no cambia.`,
  };
}
