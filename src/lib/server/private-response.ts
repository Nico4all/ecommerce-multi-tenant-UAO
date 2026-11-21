import "server-only";

/** Reconstruir conserva cuerpo, estado y cookies sin mutar cabeceras inmutables. */
export function privateResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  const vary = new Set((headers.get("Vary") ?? "").split(",").map(value => value.trim()).filter(Boolean));
  ["Host", "Forwarded", "X-Forwarded-Host"].forEach(value => vary.add(value));
  headers.set("Vary", [...vary].join(", "));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
