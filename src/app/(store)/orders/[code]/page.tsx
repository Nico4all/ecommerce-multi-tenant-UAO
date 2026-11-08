import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Check,
  Truck,
  MapPin,
  ExternalLink,
  Package,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/admin/status-badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { RetryPayment } from "@/components/orders/retry-payment";
import { PaymentNotice, paymentState } from "@/components/orders/payment-state";
import { getSession } from "@/lib/server/auth";
import { getOrderByCode } from "@/lib/server/orders";
import { formatPrice } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  fulfillmentSteps,
} from "@/lib/order-status";
import { SITE_NAME } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Pedido ${code} — ${SITE_NAME}`,
    // Pedido de una persona concreta: no tiene nada que hacer en un buscador.
    robots: { index: false, follow: false },
  };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await getSession();
  const { code } = await params;
  // Si no hay sesión (p.ej. viene del enlace "Ver mi pedido" del correo), lo
  // manda a iniciar sesión y de ahí derecho a ESTE pedido, no a la lista genérica.
  if (!session) redirect(`/login?next=${encodeURIComponent(`/orders/${code}`)}`);

  const order = await getOrderByCode(code).catch(() => null);
  if (!order) notFound();

  const statusLabel = ORDER_STATUS_LABEL[order.status] ?? order.status;
  // El paso actual se busca por la MISMA etiqueta que usa el stepper. Antes
  // había una segunda lista de claves en inglés en paralelo a `fulfillmentSteps`
  // y las dos tenían que coincidir por índice para que el stepper no mintiera.
  const currentIndex = fulfillmentSteps.findIndex((s) => s.key === statusLabel);
  const isCancelled = order.status === "CANCELLED";
  // Un pedido entregado o cancelado ya no cambia: ahí no se refresca más.
  const enCurso = !isCancelled && order.status !== "DELIVERED";
  const payment = paymentState(order);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* El cliente ve pasar su pedido a Enviado/Entregado sin recargar. */}
      {enCurso && <AutoRefresh seconds={30} />}
      <div className="mb-6 flex items-start gap-3">
        <Link
          href="/orders"
          aria-label="Volver a mis pedidos"
          className="grid size-9 shrink-0 place-items-center rounded-md border border-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold tracking-tight">
            Pedido <span className="font-mono">{order.code}</span>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Realizado el {order.date}</span>
            <StatusBadge status={statusLabel} />
          </div>
        </div>
      </div>

      {/* Qué pasó con el pago y qué puede hacer el cliente al respecto. Antes
          solo se cubría un caso (pendiente con pasarela); un pago rechazado no
          se explicaba en ninguna parte. */}
      {payment && (
        <PaymentNotice
          state={payment}
          className="mb-4"
          action={
            payment.canPay ? (
              <RetryPayment code={order.code} />
            ) : payment.key === "cancelled" ? (
              <Link
                href="/pqr"
                className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
              >
                Radicar mi caso
              </Link>
            ) : undefined
          }
        />
      )}

      {/* Progreso del envío */}
      <section
        aria-labelledby="estado-envio"
        className="mb-4 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="estado-envio" className="mb-5 font-heading font-semibold">
          Estado del envío
        </h2>
        {isCancelled ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
            Este pedido fue cancelado, así que no tiene envío en curso.
          </p>
        ) : (
          /* En columna hasta sm: cinco etiquetas en fila no caben a 360px sin
             encimarse. La línea va en posición absoluta para que la etiqueta
             quede siempre debajo (o al lado) de su propio círculo. */
          <ol className="sm:flex">
            {fulfillmentSteps.map((s, i) => {
              const done = i <= currentIndex;
              const active = i === currentIndex;
              const last = i === fulfillmentSteps.length - 1;
              return (
                <li
                  key={s.key}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "relative flex gap-3 sm:flex-1 sm:flex-col sm:items-center sm:gap-1.5",
                    !last && "pb-7 sm:pb-0",
                    last && "sm:flex-none",
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground",
                      active && "ring-4 ring-primary/15",
                    )}
                  >
                    {done ? (
                      <Check aria-hidden className="size-4" />
                    ) : (
                      <span aria-hidden className="text-xs font-bold">{i + 1}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "self-start pt-1 text-sm font-medium sm:self-auto sm:pt-0 sm:text-center sm:text-[11px]",
                      done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                    {active && <span className="sr-only"> (estado actual)</span>}
                  </span>
                  {!last && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-4 top-8 bottom-0 w-0.5 -translate-x-1/2",
                        "sm:left-1/2 sm:top-4 sm:bottom-auto sm:h-0.5 sm:w-full sm:-translate-y-1/2 sm:translate-x-0",
                        i < currentIndex ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {/* Rastreo: se muestra con lo que haya (transportadora y/o guía). El
            botón de rastrear solo aparece si además hay enlace. */}
        {(order.carrier || order.trackingNumber || order.trackingUrl) && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
            <span className="flex items-center gap-2 text-sm">
              <Truck aria-hidden className="size-4 text-primary" />
              {order.carrier ?? "Envío"}
              {order.trackingNumber && (
                <>
                  {" · Guía "}
                  <span className="font-mono font-medium">
                    {order.trackingNumber}
                  </span>
                </>
              )}
            </span>
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Rastrear el pedido ${order.code} (se abre en otra pestaña)`}
                className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Rastrear mi paquete <ExternalLink aria-hidden className="size-3.5" />
              </a>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Artículos */}
        <section
          aria-labelledby="articulos"
          className="rounded-xl border border-border bg-card p-5"
        >
          <h2
            id="articulos"
            className="mb-3 flex items-center gap-2 font-heading font-semibold"
          >
            <Package aria-hidden className="size-4 text-primary" />
            Artículos
          </h2>
          <ul className="space-y-1.5 text-sm">
            {order.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span className="line-clamp-2 text-muted-foreground">
                  {i.qty}× {i.name}
                  {i.variantName ? ` · ${i.variantName}` : ""}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatPrice(i.unitPrice * i.qty)}
                </span>
              </li>
            ))}
          </ul>
          <Separator className="my-3" />
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <dt>Subtotal</dt>
              <dd className="shrink-0 tabular-nums">{formatPrice(order.subtotal)}</dd>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between gap-3 text-primary">
                <dt>Descuento</dt>
                <dd className="shrink-0 tabular-nums">
                  -{formatPrice(order.discountTotal)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3 text-muted-foreground">
              <dt>Envío</dt>
              <dd className="shrink-0 tabular-nums">
                {order.shippingCost === 0 ? (
                  <span className="font-semibold text-foreground">Gratis</span>
                ) : (
                  formatPrice(order.shippingCost)
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3 pt-1 font-heading font-bold">
              <dt>Total</dt>
              <dd className="shrink-0 tabular-nums">{formatPrice(order.total)}</dd>
            </div>
            {order.paymentMethod && (
              <div className="flex justify-between gap-3 pt-2 text-muted-foreground">
                <dt>Método de pago</dt>
                <dd className="shrink-0 text-right">
                  {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Envío + historial */}
        <section
          aria-labelledby="entrega"
          className="rounded-xl border border-border bg-card p-5"
        >
          <h2
            id="entrega"
            className="mb-3 flex items-center gap-2 font-heading font-semibold"
          >
            <MapPin aria-hidden className="size-4 text-primary" />
            Entrega
          </h2>
          <p className="text-sm font-medium">{order.shippingName}</p>
          <p className="text-sm text-muted-foreground">{order.address}</p>

          <Separator className="my-4" />

          <h3
            id="historial"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Historial
          </h3>
          <ol aria-labelledby="historial" className="space-y-2">
            {order.events.map((e, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm">
                <CircleDot aria-hidden className="size-3 shrink-0 text-primary" />
                <span className="first-letter:uppercase">
                  {(ORDER_STATUS_LABEL[e.status] ?? e.status).replace("_", " ")}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                  {e.createdAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
