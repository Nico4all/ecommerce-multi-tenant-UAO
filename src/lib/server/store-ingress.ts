import "server-only";
import { NextResponse } from "next/server";
import { resolveStoreRequest } from "@/lib/prisma";
import { runWithStoreContext, StoreContextError } from "./store-context";
import { uploadResponse } from "./upload-response";

export const privateStoreHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Host, Forwarded, X-Forwarded-Host" };

export async function storeIngress(request: Request) {
  // Única entrada sin tenant de navegador: autentica firma y API del proveedor
  // en su handler y resuelve la tienda por la referencia persistida del pago.
  if (request.method === "POST" && new URL(request.url).pathname === "/api/webhooks/wompi") {
    return { response: NextResponse.next({ headers: privateStoreHeaders }) };
  }
  try {
    const context = await resolveStoreRequest(request);
    const url = new URL(request.url);
    if (url.pathname === "/_next/image") {
      const source = url.searchParams.get("url");
      if (source) {
        let image: URL;
        try { image = new URL(source, context.origin); }
        catch { throw new StoreContextError(400, "URL de imagen inválida"); }
        const decodedPath = decodeURIComponent(image.pathname);
        if (decodedPath.includes("%") || decodedPath.startsWith("//") || /[\\?#]/.test(decodedPath)) {
          throw new StoreContextError(400, "Ruta de imagen ambigua");
        }
        const imagePath = new URL(decodedPath, context.origin).pathname;
        if (imagePath.startsWith("/api/uploads/")) {
          // El caché de imágenes de Next usa href/width/quality, sin Host.
          // Servir el original bajo su contexto evita reutilizar bytes de otra tienda.
          const key = imagePath.slice("/api/uploads/".length);
          const response = image.origin === context.origin
            ? await runWithStoreContext(context, () => uploadResponse(key))
            : new Response("No encontrado", { status: 404 });
          Object.entries(privateStoreHeaders).forEach(([key, value]) => response.headers.set(key, value));
          return { response };
        }
      }
    }
    return { context };
  } catch (error) {
    const status = error instanceof StoreContextError ? error.status : error instanceof URIError ? 400 : 503;
    const message = status === 503 ? "No se pudo validar la tienda" : status === 404 ? "Tienda no encontrada" : "Host o solicitud inválidos";
    if (status === 503) console.error("[store] No se pudo validar el contexto de entrada");
    const response = new URL(request.url).pathname.startsWith("/api/")
      ? Response.json({ ok: false, error: message }, { status, headers: privateStoreHeaders })
      : new Response(message, { status, headers: privateStoreHeaders });
    return { response };
  }
}
