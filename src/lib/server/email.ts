import "server-only";
import nodemailer from "nodemailer";

/**
 * Envío de correo por SMTP (nodemailer).
 *
 * Se configura en `.env` con `SMTP_HOST/PORT/USER/PASS` + `EMAIL_FROM`. Con
 * Gmail: `SMTP_USER` es tu correo y `SMTP_PASS` una "contraseña de aplicación"
 * (https://myaccount.google.com/apppasswords), NO la contraseña normal.
 *
 * Si NO está configurado (falta host o contraseña), no se envía nada: el correo
 * se vuelca a la consola para poder seguir el flujo en desarrollo —p.ej. copiar
 * el enlace de recuperación— sin depender de un servidor de correo.
 *
 * `sendEmail` nunca lanza por un fallo de envío: un correo caído no debe tumbar
 * la operación que lo dispara. Devuelve si se envió.
 */

export interface Mail {
  to: string;
  subject: string;
  html: string;
  /** Versión en texto plano (clientes sin HTML y anti-spam). */
  text: string;
  /**
   * A quién contesta el botón "Responder" del cliente de correo. Lo usan los
   * avisos internos (PQR, pedidos) para poder responderle al cliente directo
   * desde Gmail, sin copiar la dirección a mano.
   */
  replyTo?: string;
}

const FROM =
  process.env.EMAIL_FROM ?? "Variedades Los Primos <no-reply@variedadeslosprimos.com>";

/**
 * Buzón interno del equipo: a donde llegan los avisos de PQR, contacto y
 * pedidos nuevos. Se configura con `STORE_EMAIL`; si falta, cae a `SMTP_USER`
 * (la cuenta desde la que ya se envía), y si tampoco está, no hay a dónde
 * avisar y quien llama se lo salta.
 */
export function storeEmail(): string | null {
  return process.env.STORE_EMAIL || process.env.SMTP_USER || null;
}

/** Transporte SMTP, o `null` si falta configuración imprescindible. */
function transport() {
  const host = process.env.SMTP_HOST;
  const pass = process.env.SMTP_PASS;
  // Sin host o sin contraseña no tiene sentido intentar: se cae a consola.
  if (!host || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = TLS implícito; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass },
  });
}

export async function sendEmail(mail: Mail): Promise<{ sent: boolean }> {
  const tx = transport();

  if (!tx) {
    console.warn(
      `\n[email] SMTP sin configurar — correo NO enviado a ${mail.to}\n` +
        `  Asunto: ${mail.subject}\n` +
        `  ${mail.text.replace(/\n/g, "\n  ")}\n`,
    );
    return { sent: false };
  }

  try {
    await tx.sendMail({
      from: FROM,
      to: mail.to,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] fallo al enviar por SMTP:", e);
    return { sent: false };
  }
}
