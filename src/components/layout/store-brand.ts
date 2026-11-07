/**
 * Identidad de la tienda activa.
 *
 * La plataforma es multi-tienda, pero la resolución de tienda vive en el
 * backend y todavía no está integrada en la UI. Para no acoplar la capa visual
 * a un contrato que aún no existe, la identidad viaja como prop desde
 * `src/app/(store)/layout.tsx` y aquí sólo queda el valor por defecto.
 *
 * Cuando exista resolución de tienda, el único punto que cambia es ese layout:
 * ningún componente de cabecera o pie conoce de dónde sale la marca.
 *
 * El sistema de color NO forma parte de la marca: es el de A01, común a todas
 * las tiendas, y es lo que da la experiencia visual coherente. Lo que varía por
 * tienda es su identidad comercial: logotipo, nombre, lema y redes.
 */

export type BrandAsset = {
  /** Ruta pública del activo. */
  src: string;
  /** Nombre del comercio; se usa como texto alternativo. */
  alt: string;
  /** Dimensiones reales del archivo, para reservar el hueco mientras carga. */
  width: number;
  height: number;
};

export type StoreSocialPlatform = "facebook" | "instagram" | "x" | "youtube";

/** Una red social de la tienda. Sin URL real no se declara: ver `social`. */
export type StoreSocialLink = {
  platform: StoreSocialPlatform;
  href: string;
};

export type StoreBrand = {
  /** Nombre comercial completo. */
  name: string;
  /** Frase corta que acompaña al logotipo en el pie. */
  tagline: string;
  /** Logotipo de la tienda. */
  logo: BrandAsset;
  /**
   * Redes de la tienda. Solo URLs reales: lo que no esté en esta lista no se
   * pinta, para no dejar iconos que no llevan a ninguna parte.
   */
  social: StoreSocialLink[];
};

/** Marca por defecto: la tienda que sirve hoy la aplicación. */
export const DEFAULT_STORE_BRAND: StoreBrand = {
  name: "Variedades Los Primos",
  tagline: "Todo lo que buscas, en un solo lugar.",
  logo: {
    src: "/logo-variedades-los-primos.svg",
    alt: "Variedades Los Primos",
    width: 640,
    height: 150,
  },
  social: [],
};
