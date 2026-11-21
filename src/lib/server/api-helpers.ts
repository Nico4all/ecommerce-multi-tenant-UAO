import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getStoreContext, resolveStoreRequest } from "@/lib/prisma";
import { runWithStoreContext, StoreContextError } from "./store-context";

/** Error de negocio con código HTTP; los servicios lo lanzan y la API lo traduce. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, details },
    { status },
  );
}

/**
 * Envuelve un handler: captura ApiError (status propio), ZodError (400 con
 * detalle por campo) y errores inesperados (500 sin filtrar internos).
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    const privateResponse = (response: Response) => {
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      const vary = new Set((response.headers.get("Vary") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
      ["Host", "Forwarded", "X-Forwarded-Host"].forEach((value) => vary.add(value));
      response.headers.set("Vary", [...vary].join(", "));
      return response;
    };
    try {
      const request = (args as unknown[])[0];
      const store = request instanceof Request ? await resolveStoreRequest(request) : await getStoreContext();
      return privateResponse(await runWithStoreContext(store, () => handler(...args)));
    } catch (e) {
      if (e instanceof StoreContextError || e instanceof ApiError) return privateResponse(jsonError(e.status, e.message));
      if (e instanceof z.ZodError) {
        return privateResponse(jsonError(400, "Datos inválidos", z.flattenError(e).fieldErrors));
      }
      console.error("[api] error inesperado:", e);
      return privateResponse(jsonError(500, "Error interno del servidor"));
    }
  };
}

/** Lee y valida el body JSON contra un esquema zod (lanza ZodError si falla). */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "El cuerpo debe ser JSON válido");
  }
  return schema.parse(raw);
}
