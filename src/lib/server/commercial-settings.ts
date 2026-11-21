import "server-only";
import { z } from "zod";
import { prisma, getStoreContext } from "@/lib/prisma";
import { ORIGINAL_STORE_ID } from "../../../prisma/stores";
import { assertImageReferences } from "./storage";

/** Una sola dirección; nunca listas, nombres libres ni cabeceras del cliente. */
export function mailbox(value: string | null | undefined): string | null {
  if (!value || /[\r\n\x00]/.test(value)) return null;
  const address = value.trim();
  return address.length <= 254 && z.email().safeParse(address).success ? address : null;
}

export function configuredSender() {
  const raw = process.env.EMAIL_FROM?.trim();
  if (raw && !/[\r\n\x00]/.test(raw)) {
    const match = /^(?:[^<>]*<([^<>]+)>|([^<>]+))$/.exec(raw);
    const address = mailbox(match?.[1] ?? match?.[2]);
    if (address) return address;
  }
  return mailbox(process.env.SMTP_USER);
}

export interface EmailBranding {
  storeId: string;
  name: string;
  origin: string;
  logoUrl: string | null;
  currency: string;
  locale: string;
}

/** Sin caché global: datos comerciales resueltos desde el contexto validado. */
export async function getCommercialSettings() {
  const store = await getStoreContext();
  const settings = await prisma.storeSettings.findUnique({ where: { storeId: store.id } });
  const fallback = configuredSender();
  const allowed = [fallback, mailbox(process.env.SMTP_USER)].filter((value): value is string => !!value);
  const requested = mailbox(settings?.senderEmail);
  const sender = requested && allowed.some((value) => value.toLowerCase() === requested.toLowerCase()) ? requested : fallback;
  const original = store.id === ORIGINAL_STORE_ID;
  const notificationEmail = settings?.notificationEmail != null
    ? mailbox(settings.notificationEmail)
    : original ? mailbox(process.env.STORE_EMAIL) ?? mailbox(process.env.SMTP_USER) : null;
  let logoUrl: string | null = original ? `${store.origin}/email-logo.png` : null;
  if (settings?.emailLogoUrl) {
    try {
      await assertImageReferences([settings.emailLogoUrl]);
      const url = new URL(settings.emailLogoUrl, store.origin);
      // El logo comercial se sirve únicamente desde esta tienda.
      logoUrl = url.origin === store.origin && ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch { logoUrl = null; }
  }
  const currency = /^[A-Z]{3}$/.test(settings?.currency ?? "") ? settings!.currency : "COP";
  let locale = settings?.locale || "es-CO";
  try { new Intl.NumberFormat(locale, { style: "currency", currency }); } catch { locale = "es-CO"; }
  const branding: EmailBranding = { storeId: store.id, name: store.name, origin: store.origin, logoUrl, currency, locale };
  return {
    branding, sender, notificationEmail,
    contactEmail: mailbox(settings?.contactEmail),
    description: settings?.seoDescription?.replace(/\s+/g, " ").trim() || `Compra online en ${store.name}.`,
  };
}

export function commercialPrice(value: number, branding?: EmailBranding) {
  return new Intl.NumberFormat(branding?.locale ?? "es-CO", { style: "currency", currency: branding?.currency ?? "COP", maximumFractionDigits: 0 }).format(value);
}
