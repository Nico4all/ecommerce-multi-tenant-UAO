import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  XCircle,
  Package,
  MapPin,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/admin/status-badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { RetryPayment } from "@/components/orders/retry-payment";
import { PaymentNotice, paymentState } from "@/components/orders/payment-state";
import { getOrderByCode } from "@/lib/server/orders";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { SITE_NAME } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    // Neutral a propósito: esta misma URL atiende un pago aprobado y uno
    // rechazado, así que el título no puede felicitar a nadie de antemano.
    title: `Pedido ${code} — ${SITE_NAME}`,
    // Un pedido de invitado se consulta con solo su código: fuera del índice.
    robots: { index: false, follow: false },
  };
}

/** Encabezado por resultado del pago. El resto de la página no cambia. */
const HEADINGS: Record<
  string,
  { title: string; icon: LucideIcon; ringClass: string; iconClass: string }
> = {
  approved: {
    title: "¡Gracias por tu compra!",
    icon: CheckCircle2,
    ringClass: "bg-success/15",
    iconClass: "text-success-ink",
  },
  "on-delivery": {
    title: "¡Pedido confirmado!",
    icon: CheckCircle2,
    ringClass: "bg-success/15",
    iconClass: "text-success-ink",
  },
  pending: {
    title: "Tu pedido quedó registrado",
    icon: Clock3,
    ringClass: "bg-deal/15",
    iconClass: "text-deal-ink",
  },
  awaiting: {
    title: "Tu pedido quedó registrado",
    icon: Clock3,
    ringClass: "bg-deal/15",
    iconClass: "text-deal-ink",
  },
  declined: {
    title: "No pudimos procesar tu pago",
    icon: XCircle,
    ringClass: "bg-destructive/10",
    iconClass: "text-destructive",
  },
  cancelled: {
    title: "Este pedido quedó cancelado",
    icon: XCircle,
    ringClass: "bg-destructive/10",
    iconClass: "text-destructive",
  },
};

const FALLBACK_HEADING = {
  title: "Tu pedido quedó registrado",
  icon: Package,
  ringClass: "bg-muted",
  iconClass: "text-primary",
};

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ pago?: string }>;
}) {
  const [{ code }, { pago }] = await Promise.all([params, searchParams]);
  const order = await getOrderByCode(code).catch(() => null);
  if (!order) notFound();

  // Lo pone /checkout/confirmacion cuando verificó el rechazo contra Wompi.
  // paymentState solo lo honra si el pedido está realmente cancelado.
  const payment = paymentState({ ...order, declined: pago === "rechazado" });
  const heading = (payment && HEADINGS[payment.key]) ?? FALLBACK_HEADING;
  const Icon = heading.icon;
  // Con la pasarela, un pago puede quedar pendiente de verdad (PSE, efectivo en
  // corresponsal). Mientras siga así, la página se pone al día sola y el
  // cliente ve el cambio a aprobado sin tener que recargar.
  const esperandoPago = payment?.key === "pending";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {esperandoPago && <AutoRefresh seconds={20} />}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-10">
        <div className="text-center">
          <span
            className={cn(
              "mx-auto grid size-16 place-items-center rounded-full",
              heading.ringClass,
            )}
          >
            <Icon aria-hidden className={cn("size-9", heading.iconClass)} />
          </span>
          <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight">
            {heading.title}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Pedido{" "}
            <span className="font-mono font-semibold text-foreground">
              {order.code}
            </span>
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <StatusBadge status={ORDER_STATUS_LABEL[order.status] ?? order.status} />
          </div>
        </div>

        {/* Qué pasó con el pago y, si se puede hacer algo, el botón para
            hacerlo. Deducido del estado del pedido: ver payment-state.tsx. */}
        {payment && (
          <PaymentNotice
            state={payment}
            className="mt-6"
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

        <Separator className="my-6" />

        {/* Artículos */}
        <section aria-labelledby="resumen-pedido">
          <h2
            id="resumen-pedido"
            className="mb-3 flex items-center gap-2 font-heading font-semibold"
          >
            <Package aria-hidden className="size-4 text-primary" />
            Resumen
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
          <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
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
            <div className="flex justify-between gap-3 pt-1 font-heading text-base font-bold">
              <dt>Total</dt>
              <dd className="shrink-0 tabular-nums">{formatPrice(order.total)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            {/* Un pedido cancelado no se va a enviar: ahí la dirección es el
                dato registrado, no una promesa de entrega. */}
            <span>
              {order.status === "CANCELLED" ? "Dirección registrada: " : "Se enviará a "}
              <span className="font-medium text-foreground">
                {order.shippingName}
              </span>
              , {order.address}
            </span>
          </div>
        </section>

        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          {!order.isGuest && (
            <Link
              href={`/orders/${order.code}`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              Ver mi pedido
            </Link>
          )}
          <Link href="/" className={cn(buttonVariants(), "gap-1.5")}>
            Seguir comprando
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
