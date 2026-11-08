import { redirect } from "next/navigation";
import {
  fetchWompiTransaction,
  applyWompiTransaction,
} from "@/lib/server/wompi";

/**
 * Página de retorno del Web Checkout de Wompi (redirect-url).
 *
 * Wompi vuelve aquí con ?id=<transacción>. Se consulta el estado directo a la
 * API de Wompi (nunca se confía en parámetros de la URL) y se aplica a la
 * orden — la misma lógica idempotente del webhook, por si este aún no llegó.
 * Luego se redirige a la página del pedido, que es la que explica en qué
 * quedó el pago (aprobado, pendiente o rechazado).
 *
 * Si la transacción no se puede verificar, el destino sigue siendo la lista de
 * pedidos, pero marcada: antes el cliente aterrizaba ahí sin ninguna
 * explicación después de haber pasado por la pasarela.
 */
export default async function WompiReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) redirect("/orders");

  const tx = await fetchWompiTransaction(id).catch(() => null);
  const result = tx ? await applyWompiTransaction(tx).catch(() => null) : null;

  if (!result) redirect("/orders?pago=sin-confirmar");

  // Este es el único punto del flujo que SABE que la transacción se rechazó:
  // lo acaba de verificar contra la API de Wompi. El pedido cancelado, por sí
  // solo, no distingue un rechazo de una cancelación de la tienda, así que el
  // dato viaja para que la pantalla de llegada pueda decirlo sin inventar.
  const rechazado = result.status === "CANCELLED";
  redirect(
    `/checkout/success/${result.code}${rechazado ? "?pago=rechazado" : ""}`,
  );
}
