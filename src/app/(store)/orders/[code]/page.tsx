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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/admin/status-badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { RetryPayment } from "@/components/orders/retry-payment";
import { getSession } from "@/lib/server/auth";
import { getOrderByCode } from "@/lib/server/orders";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, fulfillmentSteps } from "@/lib/order-status";

export const metadata: Metadata = {
  title: "Detalle del pedido — Variedades Los Primos",
};

/** Etiquetas del stepper en el orden del flujo (mismas del admin). */
const STEP_KEYS = ["PAID", "PACKING", "SHIPPED", "IN_TRANSIT", "DELIVERED"];

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

  const currentIndex = STEP_KEYS.indexOf(order.status);
  const isCancelled = order.status === "CANCELLED";
  // Un pedido entregado o cancelado ya no cambia: ahí no se refresca más.
  const enCurso = !isCancelled && order.status !== "DELIVERED";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* El cliente ve pasar su pedido a Enviado/Entregado sin recargar. */}
      {enCurso && <AutoRefresh seconds={30} />}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/orders"
          aria-label="Volver a mis pedidos"
          className="grid size-9 place-items-center rounded-md border border-border hover:bg-accent"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            Pedido {order.code}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Realizado el {order.date}
            <StatusBadge status={ORDER_STATUS_LABEL[order.status] ?? order.status} />
          </div>
        </div>
      </div>

      {/* Pendiente de pago por pasarela: se le ofrece pagarlo. Wompi quema la
          referencia en cada intento, así que el enlace anterior ya no sirve y
          hay que pedir uno nuevo (ver retryOrderPayment). */}
      {order.status === "PENDING" && order.paymentMethod === "WOMPI" && (
        <section className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="font-heading font-semibold">Tu pedido está sin pagar</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            No hemos recibido la confirmación del pago. Si el intento anterior
            falló o lo dejaste a medias, puedes pagarlo ahora; lo guardamos tal
            como lo dejaste.
          </p>
          <RetryPayment code={order.code} />
        </section>
      )}

      {/* Progreso del envío */}
      <section className="mb-4 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-5 font-heading font-semibold">Estado del envío</h2>
        {isCancelled ? (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
            Este pedido fue cancelado.
          </div>
        ) : (
          <ol className="flex items-center">
            {fulfillmentSteps.map((s, i) => {
              const done = i <= currentIndex;
              const active = i === currentIndex;
              return (
                <li key={s.key} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-full border-2 transition-colors",
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground",
                        active && "ring-4 ring-primary/15",
                      )}
                    >
                      {done ? (
                        <Check className="size-4" />
                      ) : (
                        <span className="text-xs font-bold">{i + 1}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        done ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < fulfillmentSteps.length - 1 && (
                    <span
                      className={cn(
                        "mx-1 h-0.5 flex-1",
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
              <Truck className="size-4 text-primary" />
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
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Rastrear mi paquete <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Artículos */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
            <Package className="size-4 text-primary" />
            Artículos
          </h2>
          <ul className="space-y-1.5 text-sm">
            {order.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span className="line-clamp-1 text-muted-foreground">
                  {i.qty}× {i.name}{i.variantName ? ` · ${i.variantName}` : ""}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatPrice(i.unitPrice * i.qty)}
                </span>
              </li>
            ))}
          </ul>
          <Separator className="my-3" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between text-primary">
                <span>Descuento</span>
                <span className="tabular-nums">-{formatPrice(order.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Envío</span>
              <span className="tabular-nums">
                {order.shippingCost === 0 ? "Gratis" : formatPrice(order.shippingCost)}
              </span>
            </div>
            <div className="flex justify-between pt-1 font-heading font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(order.total)}</span>
            </div>
          </div>
        </section>

        {/* Envío + historial */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
            <MapPin className="size-4 text-primary" />
            Entrega
          </h2>
          <p className="text-sm font-medium">{order.shippingName}</p>
          <p className="text-sm text-muted-foreground">{order.address}</p>

          <Separator className="my-4" />

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial
          </h3>
          <ul className="space-y-2">
            {order.events.map((e, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm">
                <span className="size-1.5 rounded-full bg-primary" />
                <span className="capitalize">
                  {(ORDER_STATUS_LABEL[e.status] ?? e.status).replace("_", " ")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {e.createdAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
