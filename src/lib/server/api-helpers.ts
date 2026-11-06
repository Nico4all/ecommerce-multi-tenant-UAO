import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

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
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ApiError) return jsonError(e.status, e.message);
      if (e instanceof z.ZodError) {
        return jsonError(400, "Datos inválidos", z.flattenError(e).fieldErrors);
      }
      console.error("[api] error inesperado:", e);
      return jsonError(500, "Error interno del servidor");
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
