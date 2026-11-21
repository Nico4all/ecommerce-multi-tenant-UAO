import { withErrorHandling, jsonOk, ApiError } from "@/lib/server/api-helpers";
import { requireAdmin } from "@/lib/server/auth";
import { processAndStoreImage } from "@/lib/server/images";
import {
  IMAGE_PRESETS,
  MAX_REQUEST_BYTES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  type ImagePreset,
} from "@/lib/image-limits";

/**
 * Subida de imágenes del panel. Recibe multipart/form-data con:
 *   file   -> el binario (ya comprimido por el navegador)
 *   preset -> "product" | "banner" | "category"
 *
 * Devuelve la ruta pública, que es lo único que se guarda en la BD.
 */
export const POST = withErrorHandling(async (req: Request) => {
  await requireAdmin();

  // Se corta por Content-Length ANTES de tocar el cuerpo: no tiene sentido
  // bufferizar 50 MB para luego rechazarlos, y además Next trunca la petición a
  // 10 MB, con lo que el multipart llegaría cortado y el error sería confuso.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES) {
    throw new ApiError(
      413,
      `La imagen pesa ${formatBytes(declared)} y el máximo es ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "No se pudo leer el archivo enviado");
  }

  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Falta el archivo");

  const preset = String(form.get("preset") ?? "product");
  if (!Object.hasOwn(IMAGE_PRESETS, preset)) {
    throw new ApiError(400, "Tipo de imagen desconocido");
  }

  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "La imagen excede el tamaño permitido");

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = await processAndStoreImage(buffer, preset as ImagePreset);

  return jsonOk(image, { status: 201 });
});
