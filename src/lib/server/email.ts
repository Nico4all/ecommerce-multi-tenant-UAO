import "server-only";
import nodemailer from "nodemailer";
import { getCommercialSettings, mailbox } from "./commercial-settings";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/** El buzón global previo solo se usa como fallback de la tienda original. */
export async function storeEmail(): Promise<string | null> {
  return (await getCommercialSettings()).notificationEmail;
}

function transport() {
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return nodemailer.createTransport({
    host, port, secure: port === 465, auth: { user, pass },
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
  });
}

/** Inyección de transporte para ensayos locales; producción conserva SMTP Nodemailer. */
export function createEmailSender(getTransport = transport) {
  return async (mail: Mail): Promise<{ sent: boolean }> => {
    try {
      const config = await getCommercialSettings(), to = mailbox(mail.to);
      const tx = getTransport();
      if (!to || !config.sender || !tx) {
        console.warn("[email] correo no enviado: configuración incompleta o dirección inválida");
        return { sent: false };
      }
      const replyTo = mailbox(mail.replyTo) ?? config.contactEmail;
      await tx.sendMail({
        from: { name: config.branding.name.replace(/[\r\n\x00]/g, " "), address: config.sender },
        to, envelope: { from: config.sender, to: [to] },
        ...(replyTo ? { replyTo } : {}),
        subject: mail.subject.replace(/[\r\n\x00]/g, " "), html: mail.html, text: mail.text,
        disableFileAccess: true, disableUrlAccess: true,
      });
      return { sent: true };
    } catch {
      // No registrar destinatarios, enlaces de recuperación, credenciales ni errores del proveedor.
      console.warn("[email] correo no enviado: servicio no disponible");
      return { sent: false };
    }
  };
}

export const sendEmail = createEmailSender();
