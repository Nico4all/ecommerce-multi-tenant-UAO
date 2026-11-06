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
