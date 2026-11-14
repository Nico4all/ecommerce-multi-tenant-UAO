import "server-only";
import { ApiError } from "./api-helpers";
import { eventSchema, transactionSchema, type WompiTransaction } from "./wompi";

/** El handler de producción fija estas dependencias a la firma y API reales. */
export function createWompiWebhookHandler(dependencies: {
  verify: (event: unknown) => boolean;
  environment: () => "test" | "prod" | null;
  load: (id: string) => Promise<WompiTransaction | null>;
  apply: (transaction: WompiTransaction) => Promise<unknown>;
}) {
  return async (request: Request) => {
    const headers = { "Cache-Control": "private, no-store, max-age=0" };
    try {
      const text = await request.text();
      if (text.length > 262144) return new Response("Evento demasiado grande", { status: 413, headers });
      let input: unknown;
      try { input = JSON.parse(text); } catch { return new Response("JSON inválido", { status: 400, headers }); }
      if (!dependencies.verify(input)) return new Response("Firma inválida", { status: 401, headers });
      const event = eventSchema.parse(input);
      const environment = dependencies.environment();
      if (!environment) throw new ApiError(503, "Wompi no está configurado");
      if (event.environment !== environment) throw new ApiError(400, "Ambiente de Wompi incorrecto");
      if (event.event === "transaction.updated") {
        const signed = transactionSchema.safeParse(event.data.transaction);
        const required = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
        if (!signed.success || required.some((property) => !event.signature.properties.includes(property))) throw new ApiError(400, "Evento de transacción incompleto");
        // Reference/currency pueden no estar firmadas: usar siempre la API autenticada.
        const actual = transactionSchema.safeParse(await dependencies.load(signed.data.id));
        if (!actual.success) throw new ApiError(503, "No se pudo consultar la transacción de Wompi");
        if (actual.data.id !== signed.data.id || actual.data.amount_in_cents !== signed.data.amount_in_cents) throw new ApiError(409, "La transacción no corresponde al evento firmado");
        await dependencies.apply(actual.data);
      }
      return Response.json({ ok: true }, { headers });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 503;
      if (status === 503) console.error("[wompi] No se pudo conciliar el evento; el proveedor debe reintentar");
      return Response.json({ ok: false, error: error instanceof ApiError ? error.message : "No se pudo conciliar el evento" }, { status, headers });
    }
  };
}
