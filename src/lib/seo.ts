export const SITE_NAME = "Variedades Los Primos";
export const SITE_URL = "https://variedadeslosprimoscol.com";

export const SITE_DESCRIPTION =
  "Compra en Variedades Los Primos, tienda online en Colombia con productos para el hogar, moda, belleza, tecnología y más.";

/** Convierte rutas internas e imágenes de la tienda en URLs canónicas absolutas. */
export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}

/** Texto corto y limpio para descriptions y datos estructurados. */
export function seoDescription(value: string | null | undefined, fallback = SITE_DESCRIPTION) {
  const clean = value?.replace(/\s+/g, " ").trim() || fallback;
  return clean.length <= 160 ? clean : `${clean.slice(0, 157).trimEnd()}...`;
}

/** Evita que contenido inesperado pueda cerrar la etiqueta JSON-LD. */
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Adaptador por request para generateMetadata; no publica ajustes de correo ni SMTP. */
export async function getStoreSeo() {
  const { getCommercialSettings } = await import("./server/commercial-settings");
  const { branding, description } = await getCommercialSettings();
  const { name, origin, locale } = branding;
  return {
    name, origin, locale, description: seoDescription(description, `Compra online en ${name}.`),
    absoluteUrl: (path = "/") => new URL(path, `${origin}/`).href,
  };
}

export async function getStoreMetadata() {
  const site = await getStoreSeo();
  return {
    metadataBase: new URL(site.origin), title: site.name, applicationName: site.name,
    description: site.description, alternates: { canonical: site.origin },
    openGraph: { siteName: site.name, title: site.name, description: site.description, url: site.origin, locale: site.locale.replace("-", "_") },
  };
}
