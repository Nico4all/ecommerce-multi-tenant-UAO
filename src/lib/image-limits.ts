import { z } from "zod";

/**
 * Límites de imagen compartidos entre el navegador y el servidor.
 *
 * No es `server-only` a propósito: el dropzone valida con estas mismas cifras
 * para avisar antes de subir, y la API vuelve a validarlas porque nunca se
 * confía en el cliente (cualquiera puede llamar al endpoint a mano).
 */

/** Lo que se acepta al elegir el archivo, antes de comprimir. */
export const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Tope duro del servidor, ya comprimido. Una foto de celular de 8 MB baja a
 * ~200-400 KB al pasarla a WebP, así que 4 MB deja margen de sobra y a la vez
 * corta cualquier intento de subir algo enorme por la API.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Tope de la petición completa: el archivo más lo que añade el multipart
 * (boundaries y cabeceras). Se usa para rechazar por Content-Length antes de
 * leer el cuerpo. Queda holgadamente por debajo del truncado a 10 MB que hace
 * Next, que dejaría un multipart cortado e imposible de parsear.
 */
export const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

/**
 * Formatos que aceptamos. Todo se guarda como WebP al final.
 * El GIF queda fuera a propósito: al recomprimirlo perdería la animación y es
 * mejor rechazarlo claro que aceptarlo y devolver una imagen quieta.
 */
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const ACCEPT_ATTR = ACCEPTED_MIME.join(",");

/**
 * Lado mayor al que se redimensiona según para qué es la imagen. No tiene
 * sentido guardar 4000px para el icono de una categoría.
 */
export const IMAGE_PRESETS = {
  /** Foto de producto: se ve grande en la PDP. */
  product: { maxEdge: 1600, quality: 82 },
  /** Fondo de banner o de sección: ancho completo. */
  banner: { maxEdge: 1920, quality: 80 },
  /** Imagen de categoría: se muestra en un círculo pequeño. */
  category: { maxEdge: 512, quality: 85 },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

/** Fotos por producto. Suficiente para enseñarlo bien sin volver lenta la ficha. */
export const MAX_PRODUCT_IMAGES = 8;

/**
 * Cada hueco de la tienda donde cabe una imagen, con la proporción REAL a la que
 * se va a ver. Los números salen de medir el layout en escritorio:
 * hero ≈ 821×288, lateral ≈ 410×288, promo ≈ 405×192, franja ≈ 1248×160.
 *
 * `crop: true` = el hueco recorta para llenar (object-cover), así que conviene
 * recortar antes de subir y decidir tú qué se ve. Las fotos de producto NO
 * recortan (se muestran enteras), así que ahí sobra el recortador.
 */
export const IMAGE_TARGETS = {
  product: {
    preset: "product",
    aspect: 1,
    crop: false,
    size: "1600 × 1600 px",
    hint: "Cuadrada. Se muestra entera, sin recortar.",
  },
  category: {
    preset: "category",
    aspect: 1,
    crop: true,
    size: "512 × 512 px",
    hint: "Cuadrada: se ve dentro de un círculo.",
  },
  bannerHero: {
    preset: "banner",
    aspect: 3,
    crop: true,
    size: "1920 × 640 px",
    hint: "Panorámica, para el carrusel principal.",
  },
  bannerSide: {
    preset: "banner",
    aspect: 1.4,
    crop: true,
    size: "840 × 600 px",
    hint: "Casi cuadrada. Con 2 o más laterales se ven más apaisados.",
  },
  bannerPromo: {
    preset: "banner",
    aspect: 2,
    crop: true,
    size: "1200 × 600 px",
    hint: "Apaisada, para la rejilla de promos.",
  },
  bannerStrip: {
    preset: "banner",
    aspect: 8,
    crop: true,
    size: "1920 × 240 px",
    hint: "Muy alargada: es una franja de ancho completo.",
  },
  sectionBg: {
    preset: "banner",
    aspect: 3,
    crop: true,
    size: "1920 × 640 px",
    hint: "Panorámica. Se ve detrás de la fila de productos.",
  },
} as const satisfies Record<
  string,
  {
    preset: ImagePreset;
    aspect: number;
    crop: boolean;
    size: string;
    hint: string;
  }
>;

export type ImageTarget = keyof typeof IMAGE_TARGETS;

/** Región recortada, en píxeles de la imagen original. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Ruta de una imagen subida por el panel: carpeta año-mes + nombre + extensión.
 * Los segmentos no admiten puntos, así que un "../.." no puede colarse.
 */
const UPLOADED_PATH = /^\/api\/uploads\/[\w-]+\/[\w-]+\.(webp|jpe?g|png|avif)$/;

/**
 * Valida el campo de imagen de un formulario.
 *
 * Acepta tres cosas: una URL externa (así eran todas hasta ahora), la ruta de
 * un archivo subido al panel, o vacío. `z.url()` a secas rechazaba la ruta
 * subida por no ser absoluta, que es justo lo que devuelve /api/admin/uploads.
 */
export const imageRefSchema = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || UPLOADED_PATH.test(v) || z.url().safeParse(v).success,
    "Debe ser una URL válida o una imagen subida desde el panel",
  );

/** "1.4 MB", "320 KB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
