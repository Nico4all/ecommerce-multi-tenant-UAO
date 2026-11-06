import { readUpload } from "@/lib/server/storage";

/**
 * Sirve las imágenes subidas. Es público a propósito: son las fotos de la
 * tienda y las ve cualquier visitante.
 *
 * `readUpload` valida que la ruta no se escape de uploads/, así que un
 * `/api/uploads/../../.env` no puede leer nada de fuera.
 */

type Ctx = { params: Promise<{ path: string[] }> };

/** Todo se guarda como WebP, pero se mapea por si en el futuro hay más. */
const TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
  gif: "image/gif",
};

export async function GET(_req: Request, ctx: Ctx) {
  const { path: segments } = await ctx.params;
  const relative = segments.join("/");

  const file = await readUpload(relative);
  if (!file) return new Response("No encontrado", { status: 404 });

  const ext = relative.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return new Response("No encontrado", { status: 404 });

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": type,
      // El nombre lleva un UUID: el contenido de una ruta nunca cambia.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(file.byteLength),
      // Evita que el navegador intente adivinar otro tipo.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
