import "server-only";
import { cache } from "react";
import type { StoreBrand } from "@/components/layout/store-brand";
import { getCommercialSettings } from "./commercial-settings";
import { escapeEmailHtml } from "./email-layout";

/** Proyección pública; nunca enviar destinatarios internos ni configuración SMTP al cliente. */
export const getStoreBrand = cache(async (): Promise<StoreBrand> => {
  const { branding, tagline } = await getCommercialSettings();
  const words = branding.name.split(/\s+/), first = words.slice(0, -2).join(" ") || words[0];
  const second = words.slice(first === words[0] ? 1 : -2).join(" ");
  const initials = words.filter((word) => !["los", "del", "de"].includes(word.toLowerCase())).map((word) => word[0]).join("").slice(0, 3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="80" viewBox="0 0 350 80"><rect x="2" y="8" width="64" height="64" rx="18" fill="#007F71"/><text x="34" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="white">${escapeEmailHtml(initials)}</text><text x="80" y="34" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#003B3A">${escapeEmailHtml(first)}</text><text x="80" y="61" font-family="Arial,sans-serif" font-size="23" font-weight="700" fill="#003B3A">${escapeEmailHtml(second)}</text></svg>`;
  return {
    name: branding.name, tagline,
    logo: { src: branding.logoUrl ?? `data:image/svg+xml,${encodeURIComponent(svg)}`, alt: branding.name, width: 350, height: 80 },
    social: [],
  };
});

export const getStoreLegalInfo = cache(async () => {
  const { branding, city, contactEmail } = await getCommercialSettings();
  return {
    nombreComercial: branding.name, ciudad: city || "Colombia",
    correoContacto: contactEmail ?? "", correoDatos: contactEmail ?? "",
    contactHref: contactEmail ? `mailto:${contactEmail}` : "/contacto",
    dataHref: contactEmail ? `mailto:${contactEmail}` : "/contacto",
  };
});
