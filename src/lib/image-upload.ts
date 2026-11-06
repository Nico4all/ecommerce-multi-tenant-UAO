import { compressImage } from "@/lib/image-compress";
import {
  ACCEPTED_MIME,
  MAX_INPUT_BYTES,
  formatBytes,
  type CropArea,
  type ImagePreset,
} from "@/lib/image-limits";

/**
 * Valida, comprime y sube una imagen desde el navegador.
 *
 * Lo comparten el subidor simple y la galería de producto. Lanza `Error` con un
 * mensaje ya legible para el usuario, así quien llama solo tiene que mostrarlo.
 */

export interface UploadedImage {
  url: string;
  width: number;
  height: number;
  /** Lo que pesa ya subida. */
  bytes: number;
  /** Lo que pesaba el archivo elegido, antes de comprimir. */
  originalBytes: number;
}

export async function uploadImage(
  file: File,
  preset: ImagePreset,
  /** Región elegida en el recortador. Sin ella se sube la imagen entera. */
  crop?: CropArea,
): Promise<UploadedImage> {
  if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    throw new Error(`"${file.name}": formato no admitido. Usa JPG, PNG, WebP o AVIF.`);
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      `"${file.name}" pesa ${formatBytes(file.size)}. El máximo es ${formatBytes(MAX_INPUT_BYTES)}.`,
    );
  }

  const compressed = await compressImage(file, preset, crop);

  const body = new FormData();
  body.append("file", compressed.file);
  body.append("preset", preset);

  // Sin Content-Type manual: el navegador pone el boundary del multipart.
  const res = await fetch("/api/admin/uploads", { method: "POST", body });
  const payload = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: Omit<UploadedImage, "originalBytes">;
    error?: string;
  } | null;

  if (!res.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error ?? "No se pudo subir la imagen");
  }
  return { ...payload.data, originalBytes: compressed.originalBytes };
}
