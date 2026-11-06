import {
  IMAGE_PRESETS,
  type CropArea,
  type ImagePreset,
} from "@/lib/image-limits";

/**
 * Compresión en el navegador, antes de subir.
 *
 * Sirve para que el usuario no espere a que suban 8 MB por una foto de celular
 * que va a acabar pesando 250 KB. NO es una medida de seguridad: el servidor
 * vuelve a validar y a recomprimir (ver lib/server/images.ts).
 */

export interface CompressResult {
  file: File;
  /** Lo que pesaba el archivo elegido. */
  originalBytes: number;
  /** Lo que pesa ya comprimido. */
  bytes: number;
  width: number;
  height: number;
}

export async function compressImage(
  file: File,
  preset: ImagePreset,
  /** Región a conservar, en píxeles de la original. Sin ella se usa entera. */
  crop?: CropArea,
): Promise<CompressResult> {
  const { maxEdge, quality } = IMAGE_PRESETS[preset];

  // `from-image` respeta la orientación EXIF: sin esto, las fotos verticales de
  // celular se suben acostadas.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  // El recorte se pide sobre la imagen ya orientada, igual que lo que ve el
  // usuario en el recortador. Se acota al lienzo por si llega algo raro.
  const sx = Math.max(0, Math.round(crop?.x ?? 0));
  const sy = Math.max(0, Math.round(crop?.y ?? 0));
  const sw = Math.min(bitmap.width - sx, Math.round(crop?.width ?? bitmap.width));
  const sh = Math.min(bitmap.height - sy, Math.round(crop?.height ?? bitmap.height));

  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Tu navegador no pudo procesar la imagen");
  }
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality / 100),
  );
  if (!blob) throw new Error("No se pudo comprimir la imagen");

  const name = file.name.replace(/\.[^.]+$/, "") || "imagen";
  return {
    file: new File([blob], `${name}.webp`, { type: "image/webp" }),
    originalBytes: file.size,
    bytes: blob.size,
    width,
    height,
  };
}
