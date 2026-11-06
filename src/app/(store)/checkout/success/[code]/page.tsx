import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Package, MapPin, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/admin/status-badge";
import { getOrderByCode } from "@/lib/server/orders";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";

export const metadata: Metadata = {
  title: "Pedido confirmado — Variedades Los Primos",
};

export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const order = await getOrderByCode(code).catch(() => null);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-10">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success/15">
          <CheckCircle2 className="size-9 text-success" />
        </span>
        <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight">
          ¡Gracias por tu compra!
        </h1>
        <p className="mt-1 text-muted-foreground">
          Tu pedido{" "}
          <span className="font-mono font-semibold text-foreground">
            {order.code}
          </span>{" "}
          fue registrado correctamente.
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <StatusBadge status={ORDER_STATUS_LABEL[order.status] ?? order.status} />
        </div>

        <Separator className="my-6" />

        {/* Artículos */}
        <div className="text-left">
          <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
            <Package className="size-4 text-primary" />
            Resumen
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
          <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
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
            <div className="flex justify-between pt-1 font-heading text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(order.total)}</span>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Se enviará a <span className="font-medium text-foreground">{order.shippingName}</span>,{" "}
              {order.address}
            </span>
          </div>
        </div>

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
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
