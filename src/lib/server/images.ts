import "server-only";
import sharp from "sharp";
import { ApiError } from "./api-helpers";
import { saveUpload } from "./storage";
import { requireAdmin } from "./auth";
import { getStoreContext } from "@/lib/prisma";
import {
  IMAGE_PRESETS,
  MAX_UPLOAD_BYTES,
  formatBytes,
  type ImagePreset,
} from "@/lib/image-limits";

/**
 * Procesado de imágenes subidas.
 *
 * El navegador ya comprime antes de subir, pero aquí se vuelve a validar y a
 * recomprimir: el cliente se puede saltar (basta con llamar a la API a mano), y
 * además sharp aporta dos cosas que el navegador no garantiza:
 *
 *  1. Verifica que el archivo sea una imagen DE VERDAD al parsearla. Mirar la
 *     extensión o el content-type no vale: los manda el cliente.
 *  2. Borra los metadatos EXIF, que en fotos de celular llevan la geolocalización
 *     de donde se tomaron.
 */

export interface ProcessedImage {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export async function processAndStoreImage(
  input: Buffer,
  preset: ImagePreset,
): Promise<ProcessedImage> {
  await requireAdmin();
  if (!Object.hasOwn(IMAGE_PRESETS, preset)) throw new ApiError(400, "Tipo de imagen desconocido");
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      413,
      `La imagen pesa ${formatBytes(input.byteLength)} y el máximo es ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    );
  }
  if (input.byteLength === 0) throw new ApiError(400, "El archivo está vacío");

  const { maxEdge, quality } = IMAGE_PRESETS[preset];

  // `failOn: "error"` hace que un archivo corrupto o disfrazado reviente aquí.
  const pipeline = sharp(input, { failOn: "error" });

  let meta;
  try {
    meta = await pipeline.metadata();
  } catch {
    throw new ApiError(400, "El archivo no es una imagen válida");
  }
  if (!meta.width || !meta.height) {
    throw new ApiError(400, "El archivo no es una imagen válida");
  }

  const output = await pipeline
    // `withoutEnlargement` evita estirar una imagen pequeña y que se vea peor.
    .rotate() // respeta la orientación EXIF antes de que se descarte
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });

  const { url } = await saveUpload(output.data, "webp");

  return {
    url: new URL(url, (await getStoreContext()).origin).href,
    width: output.info.width,
    height: output.info.height,
    bytes: output.data.byteLength,
  };
}
