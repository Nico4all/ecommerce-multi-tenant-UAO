import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma, getStoreContext, resolveWompiPaymentStore } from "@/lib/prisma";
import { runWithStoreContext } from "./store-context";
import { ApiError } from "./api-helpers";
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
  const environment = wompiEnvironment();
  return !!environment && !!process.env.WOMPI_PRIVATE_KEY?.startsWith(`prv_${environment}_`) &&
    !!process.env.WOMPI_INTEGRITY_SECRET?.startsWith(`${environment}_integrity_`);
}

export function wompiEnvironment(): "test" | "prod" | null {
  const match = /^pub_(test|prod)_.+$/.exec(process.env.WOMPI_PUBLIC_KEY ?? "");
  return match ? match[1] as "test" | "prod" : null;
}

/** Base de la API según el ambiente de las llaves. */
function apiBase(): string {
  const environment = wompiEnvironment();
  if (!environment || !env("WOMPI_PRIVATE_KEY").startsWith(`prv_${environment}_`)) throw new ApiError(503, "Wompi no está configurado correctamente");
  return environment === "test"
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
  return reference.replace(/-R\d+$/, "");
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
  if (!wompiConfigured()) throw new ApiError(503, "Wompi no está configurado correctamente");
  if (!Number.isSafeInteger(input.amountInCents) || input.amountInCents <= 0) throw new ApiError(400, "Importe de pago inválido");
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

export const transactionSchema = z.object({
  id: z.string().min(1).max(191), status: z.enum(["APPROVED", "DECLINED", "VOIDED", "ERROR", "PENDING"]),
  reference: z.string().min(1).max(191), amount_in_cents: z.number().int().nonnegative().safe(),
  currency: z.string().length(3), payment_method_type: z.string().max(40).optional(),
});

/** Consulta una transacción a la API de Wompi (server-side). */
export async function fetchWompiTransaction(
  id: string,
): Promise<WompiTransaction | null> {
  const res = await fetch(`${apiBase()}/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${env("WOMPI_PRIVATE_KEY")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    data?: WompiTransaction;
  } | null;
  const parsed = transactionSchema.safeParse(json?.data);
  return parsed.success && parsed.data.id === id ? parsed.data : null;
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
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) return [];
  const json = (await res.json().catch(() => null)) as {
    data?: WompiTransaction[];
  } | null;
  const parsed = z.array(transactionSchema).safeParse(json?.data);
  return parsed.success ? parsed.data.filter((transaction) => transaction.reference === reference) : [];
}

/** Firma dinámica según properties; rechazar rutas ausentes o no escalares. */
export function verifyWompiEvent(event: unknown, secret = process.env.WOMPI_EVENTS_SECRET): boolean {
  const parsed = eventSchema.safeParse(event);
  if (!secret || !parsed.success) return false;
  const { data, timestamp, signature } = parsed.data;
  const values = signature.properties.map((path) => {
    let value: unknown = data;
    for (const part of path.split(".")) {
      if (!value || typeof value !== "object" || !Object.hasOwn(value, part)) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return ["string", "number", "boolean"].includes(typeof value) ? String(value) : undefined;
  });
  if (values.some((value) => value === undefined)) return false;
  const expected = createHash("sha256").update(`${values.join("")}${timestamp}${secret}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature.checksum, "hex"));
}

export const eventSchema = z.object({
  event: z.string().min(1).max(100),
  environment: z.enum(["test", "prod"]),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.number().int().nonnegative().safe(),
  signature: z.object({
    properties: z.array(z.string().min(1).max(200)).min(1).max(50),
    checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  }),
});

/** El Host no interviene: el proveedor autenticado indica una referencia persistida. */
export async function applyWompiWebhookTransaction(transaction: WompiTransaction) {
  const context = await resolveWompiPaymentStore(transaction.reference);
  return context ? runWithStoreContext(context, () => applyWompiTransaction(transaction)) : null;
}

/** Retorno/admin conservan la firma pública y el contexto de su tienda actual. */
export async function applyWompiTransaction(
  transaction: WompiTransaction,
): Promise<{ code: string; status: string } | null> {
  const parsed = transactionSchema.safeParse(transaction);
  if (!parsed.success) throw new ApiError(400, "Transacción de Wompi inválida");
  const paymentTx = parsed.data;
  const { id: storeId } = await getStoreContext();
  const result = await prisma.$transaction(async (db) => {
    const match = await db.payment.findUnique({
      where: { gatewayReference: paymentTx.reference, storeId, method: "WOMPI" }, select: { id: true, orderId: true, gatewayReference: true },
    });
    // La colación de MySQL puede ignorar mayúsculas; la referencia del proveedor es exacta.
    if (!match || match.gatewayReference !== paymentTx.reference) return null;
    // El pedido es el mismo mutex para webhook, retorno, reintento y admin.
    await db.order.update({ where: { id: match.orderId, storeId }, data: { updatedAt: new Date() } });
    const order = await db.order.findUniqueOrThrow({ where: { id: match.orderId, storeId } });
    const payment = await db.payment.findUniqueOrThrow({ where: { id: match.id, storeId, orderId: order.id } });
    const expectedCents = Math.round(Number(order.total) * 100);
    if (paymentTx.currency !== CURRENCY || paymentTx.amount_in_cents !== expectedCents ||
      paymentTx.amount_in_cents !== Math.round(Number(payment.amount) * 100)) {
      throw new ApiError(409, "El importe o moneda del pago no coincide con el pedido");
    }
    if (payment.gatewayTransactionId && payment.gatewayTransactionId !== paymentTx.id) {
      throw new ApiError(409, "El intento de pago ya pertenece a otra transacción");
    }
    if (payment.status === "COMPLETED") return { code: order.code, status: order.status, emailOrderId: null };
    if (payment.status === "FAILED") {
      if (paymentTx.status === "APPROVED") throw new ApiError(409, "El intento fallido requiere conciliación manual");
      return { code: order.code, status: order.status, emailOrderId: null };
    }
    if (paymentTx.status === "APPROVED" && (order.status !== "PENDING" || order.inventoryRestoredAt)) {
      throw new ApiError(409, "El pedido ya no admite este pago; requiere conciliación manual");
    }
    await db.payment.update({
      where: { id: payment.id, storeId },
      data: {
        gatewayTransactionId: paymentTx.id,
        reference: `${paymentTx.id}${paymentTx.payment_method_type ? ` (${paymentTx.payment_method_type})` : ""}`,
        ...(paymentTx.status === "APPROVED" ? { status: "COMPLETED" } :
          ["DECLINED", "VOIDED", "ERROR"].includes(paymentTx.status) ? { status: "FAILED" } : {}),
      },
    });
    if (paymentTx.status === "APPROVED") {
      await db.order.update({ where: { id: order.id, storeId }, data: { status: "PAID" } });
      await db.orderStatusEvent.create({ data: { storeId, orderId: order.id, status: "PAID" } });
      return { code: order.code, status: "PAID", emailOrderId: order.id };
    }
    if (["DECLINED", "VOIDED", "ERROR"].includes(paymentTx.status) && order.status === "PENDING") {
      const others = await db.payment.count({
        where: { storeId, orderId: order.id, status: { in: ["PENDING", "COMPLETED"] } },
      });
      if (!others) {
        await restockOrderOnce(order.id, db);
        await db.order.update({ where: { id: order.id, storeId }, data: { status: "CANCELLED" } });
        await db.orderStatusEvent.create({ data: { storeId, orderId: order.id, status: "CANCELLED" } });
        return { code: order.code, status: "CANCELLED", emailOrderId: null };
      }
    }
    return { code: order.code, status: order.status, emailOrderId: null };
  }, { isolationLevel: "ReadCommitted", timeout: 15000 });
  if (!result) return null;
  if (result.emailOrderId) {
    await sendOrderConfirmationEmail(result.emailOrderId).catch(() => console.error("[wompi] No se pudo enviar la confirmación del pedido"));
  }
  return { code: result.code, status: result.status };
}
