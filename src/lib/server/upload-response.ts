import "server-only";
import { readUpload } from "./storage";

const types: Record<string, string> = {
  webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", avif: "image/avif", gif: "image/gif",
};

export async function uploadResponse(key: string): Promise<Response> {
  const type = types[key.split(".").pop()?.toLowerCase() ?? ""];
  const file = type ? await readUpload(key) : null;
  if (!file) return new Response("No encontrado", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new Response(new Uint8Array(file), { headers: {
    "Content-Type": type, "Content-Length": String(file.byteLength),
    "Cache-Control": "private, no-store", Vary: "Host", "X-Content-Type-Options": "nosniff",
  } });
}
