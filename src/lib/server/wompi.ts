import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { restockOrderOnce } from "./stock";
import { sendOrderConfirmationEmail } from "./order-emails";

/**
 * Integración con Wompi (Web Checkout).
 *
 * Flujo: el checkout crea la orden PENDIENTE y redirige a la página de pago de
 * Wompi con una firma de integridad (monto+referencia+moneda firmados: nadie
 * puede pagar menos alterando la URL). Wompi nos avisa del resultado por dos
 * vías que convergen en `applyWompiTransaction` (idempotente):
 *
 *   1. El webhook `/api/webhooks/wompi` (fuente de verdad, firmado).
 *   2. La página de retorno `/checkout/confirmacion` (consulta la transacción
 *      a la API de Wompi al volver el cliente, por si el webhook tarda).
 *
 * Seguridad: las llaves viven SOLO en env. La privada y los secretos jamás se
 * envían al navegador. El ambiente (sandbox/producción) se deduce del prefijo
 * de la llave (`pub_test_`/`pub_prod_`), así que cambiar de modo es solo
 * cambiar las llaves del `.env`.
 */

const CURRENCY = "COP";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en .env`);
  return v;
}

/** ¿Hay llaves configuradas? (para degradar con un error claro, no un 500 críptico) */
export function wompiConfigured(): boolean {
  return Boolean(
    process.env.WOMPI_PUBLIC_KEY &&
      process.env.WOMPI_PRIVATE_KEY &&
      process.env.WOMPI_INTEGRITY_SECRET,
  );
}

/** Base de la API según el ambiente de las llaves. */
function apiBase(): string {
  return env("WOMPI_PUBLIC_KEY").includes("_test_")
    ? "https://sandbox.wompi.co/v1"
    : "https://production.wompi.co/v1";
}

/**
 * Referencia que se le manda a Wompi para un intento de pago.
 *
 * Wompi exige que la referencia sea única PARA SIEMPRE: si una transacción ya
 * usó `VLP-10235` —aunque la rechazaran— un segundo intento con esa misma
 * referencia se rechaza con 422 "La referencia ya ha sido usada". Sin esto, a
 * un cliente al que le declinan la tarjeta no le queda forma de pagar su
 * pedido.
 *
 * El primer intento conserva el código pelado (así las referencias que ya
 * existen en Wompi siguen cuadrando); del segundo en adelante se añade
 * `-R2`, `-R3`… El sufijo lleva "R" a propósito: el código ya tiene un guion
 * seguido de dígitos (`VLP-10235`), y un `-2` sin letra sería ambiguo al
 * recortarlo.
 */
export function buildPaymentReference(code: string, attempt: number): string {
  return attempt <= 1 ? code : `${code}-R${attempt}`;
}

/** Recupera el código del pedido a partir de la referencia de un intento. */
export function orderCodeFromReference(reference: string): string {
  return reference.replace(/-Rd+$/, "");
}

/** Firma de integridad: SHA-256(referencia + monto en centavos + moneda + secreto). */
function integritySignature(reference: string, amountInCents: number): string {
  return createHash("sha256")
    .update(`${reference}${amountInCents}${CURRENCY}${env("WOMPI_INTEGRITY_SECRET")}`)
    .digest("hex");
}

/** URL del Web Checkout de Wompi lista para redirigir al cliente. */
export function buildWompiCheckoutUrl(input: {
  reference: string;
  amountInCents: number;
  customerEmail: string;
  customerName: string;
  redirectUrl: string;
}): string {
  const params = new URLSearchParams({
    "public-key": env("WOMPI_PUBLIC_KEY"),
    currency: CURRENCY,
    "amount-in-cents": String(input.amountInCents),
    reference: input.reference,
    "signature:integrity": integritySignature(input.reference, input.amountInCents),
    "redirect-url": input.redirectUrl,
    "customer-data:email": input.customerEmail,
    "customer-data:full-name": input.customerName,
  });
  return `https://checkout.wompi.co/p/?${params.toString()}`;
}

export interface WompiTransaction {
  id: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING";
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string; // CARD, PSE, NEQUI…
}

/** Consulta una transacción a la API de Wompi (server-side). */
export async function fetchWompiTransaction(
  id: string,
): Promise<WompiTransaction | null> {
  const res = await fetch(`${apiBase()}/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${env("WOMPI_PRIVATE_KEY")}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    data?: WompiTransaction;
  } | null;
  return json?.data ?? null;
}

/**
 * Busca en Wompi las transacciones de una referencia (= código del pedido).
 *
 * Sirve para conciliar a mano desde el panel cuando el pedido quedó PENDING
 * porque no llegó ni el webhook ni la vuelta del cliente: ahí no tenemos el id
 * de la transacción guardado, pero la referencia siempre es el código.
 * Devuelve lista vacía si Wompi no responde o no hay ninguna.
 */
export async function fetchWompiTransactionsByReference(
  reference: string,
): Promise<WompiTransaction[]> {
  const res = await fetch(
    `${apiBase()}/transactions?reference=${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${env("WOMPI_PRIVATE_KEY")}` },
      cache: "no-store",
    },
  );
  if (!res.ok) return [];
  const json = (await res.json().catch(() => null)) as {
    data?: WompiTransaction[];
  } | null;
  return Array.isArray(json?.data) ? json.data : [];
}

/** Lee una ruta tipo "transaction.status" dentro del objeto `data` del evento. */
function pick(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

/**
 * Verifica la firma de un evento de Wompi: SHA-256 de los valores listados en
 * `signature.properties` (en orden) + timestamp + secreto de eventos. Sin esta
 * verificación cualquiera podría marcar pedidos como pagados con un POST.
 */
export function verifyWompiEvent(event: {
  data?: unknown;
  timestamp?: number;
  signature?: { properties?: string[]; checksum?: string };
}): boolean {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  const props = event.signature?.properties;
  const checksum = event.signature?.checksum;
  if (!secret || !props || !checksum || event.timestamp === undefined) return false;

  const concatenated = props.map((p) => String(pick(event.data, p) ?? "")).join("");
  const expected = createHash("sha256")
    .update(`${concatenated}${event.timestamp}${secret}`)
    .digest("hex");
  return expected.toLowerCase() === checksum.toLowerCase();
}

/**
 * Aplica el estado de una transacción de Wompi a la orden (por `reference` =
 * código del pedido). Idempotente: webhook y página de retorno pueden llegar
 * en cualquier orden o repetirse sin efectos dobles.
 */
export async function applyWompiTransaction(
  tx: WompiTransaction,
): Promise<{ code: string; status: string } | null> {
  // La referencia puede traer el sufijo del reintento (`VLP-10235-R2`).
  const order = await prisma.order.findUnique({
    where: { code: orderCodeFromReference(tx.reference) },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) return null;
  const payment = order.payments[0] ?? null;

  if (tx.status === "APPROVED") {
    // Verificación extra: el monto aprobado debe ser el de la orden.
    const expectedCents = Math.round(Number(order.total) * 100);
    if (tx.amount_in_cents !== expectedCents || tx.currency !== CURRENCY) {
      console.error(
        `[wompi] monto no coincide en ${order.code}: esperado ${expectedCents}, llegó ${tx.amount_in_cents} ${tx.currency}`,
      );
      return { code: order.code, status: order.status };
    }
    if (payment && payment.status !== "COMPLETED") {
      await prisma.payment.update({
        where: { id: payment.id },
        // Se guarda el id de transacción de Wompi (y el medio real usado)
        // como referencia para conciliar.
        data: {
          status: "COMPLETED",
          reference: `${tx.id}${tx.payment_method_type ? ` (${tx.payment_method_type})` : ""}`,
        },
      });
    }
    if (order.status === "PENDING") {
      await prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } });
      await prisma.orderStatusEvent.create({
        data: { orderId: order.id, status: "PAID" },
      });
      // Correo de confirmación recién cuando el pago está aprobado.
      await sendOrderConfirmationEmail(order.id);
    }
    return { code: order.code, status: "PAID" };
  }

  if (tx.status === "DECLINED" || tx.status === "VOIDED" || tx.status === "ERROR") {
    if (payment && payment.status === "PENDING") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", reference: tx.id },
      });
    }
    // Solo se cancela si seguía pendiente (nunca pisar una orden ya pagada).
    if (order.status === "PENDING") {
      await restockOrderOnce(order.id);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
      await prisma.orderStatusEvent.create({
        data: { orderId: order.id, status: "CANCELLED" },
      });
    }
    return { code: order.code, status: "CANCELLED" };
  }

  // PENDING u otros estados intermedios: no se toca nada todavía.
  return { code: order.code, status: order.status };
}
