"use client";

import * as React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Botón para volver a pagar un pedido que quedó pendiente.
 *
 * No reutiliza el enlace de pago anterior a propósito: Wompi quema la
 * referencia en el primer intento y devuelve 422 ("La referencia ya ha sido
 * usada") si se repite. El servidor genera una referencia nueva por cada
 * intento; aquí solo se pide y se redirige.
 */
export function RetryPayment({ code }: { code: string }) {
  const [busy, setBusy] = React.useState(false);

  const pagar = async () => {
    setBusy(true);
    try {
      const { redirectUrl } = await api.post<{ redirectUrl: string }>(
        `/api/orders/${code}/retry-payment`,
      );
      // Navegación completa: la pasarela vive fuera de la app.
      window.location.href = redirectUrl;
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo generar el pago",
      );
      setBusy(false);
    }
  };

  return (
    <Button onClick={pagar} disabled={busy} className="w-full sm:w-auto">
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CreditCard className="size-4" />
      )}
      Pagar este pedido
    </Button>
  );
}
