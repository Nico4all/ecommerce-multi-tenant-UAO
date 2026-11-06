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
 * Luego se redirige a la página del pedido.
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

  redirect(result ? `/checkout/success/${result.code}` : "/orders");
}
