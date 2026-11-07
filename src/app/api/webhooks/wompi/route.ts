import {
  verifyWompiEvent,
  applyWompiTransaction,
  type WompiTransaction,
} from "@/lib/server/wompi";
import { withErrorHandling } from "@/lib/server/api-helpers";

/**
 * Webhook de eventos de Wompi (la fuente de verdad del estado de un pago).
 *
 * Wompi hace POST aquí cuando una transacción cambia de estado. La firma del
 * evento se verifica SIEMPRE antes de tocar nada: sin eso, cualquiera podría
 * marcar pedidos como pagados. Es público a propósito (Wompi no tiene sesión);
 * la seguridad es la firma, no una cookie.
 *
 * En local Wompi no puede alcanzar localhost: se prueba con un túnel
 * (cloudflared/ngrok) apuntando la "URL de eventos" del panel de Wompi a
 * https://<túnel>/api/webhooks/wompi
 */
export const POST = withErrorHandling(async (req: Request) => {
  let event: Parameters<typeof verifyWompiEvent>[0] & {
    event?: string;
    data?: { transaction?: WompiTransaction };
  };
  try {
    event = await req.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  if (!verifyWompiEvent(event)) {
    console.warn("[wompi] webhook con firma inválida — descartado");
    return new Response("Firma inválida", { status: 401 });
  }

  const tx = event.data?.transaction;
  if (event.event === "transaction.updated" && tx) {
    // Errores internos no deben hacer que Wompi reintente para siempre un
    // evento ya verificado: se registran y se responde 200 igual.
    await applyWompiTransaction(tx).catch((e) =>
      console.error("[wompi] error aplicando transacción:", e),
    );
  }

  return Response.json({ ok: true });
});
