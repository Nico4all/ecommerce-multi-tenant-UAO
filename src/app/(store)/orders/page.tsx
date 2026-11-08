import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageSearch, ExternalLink, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/catalog/product-grid";
import { getSession } from "@/lib/server/auth";
import { getMyOrders } from "@/lib/server/orders";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Mis pedidos — ${SITE_NAME}`,
};

const linkClass =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ pago?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/orders");

  const [orders, { pago }] = await Promise.all([getMyOrders(), searchParams]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <h1 className="flex items-center gap-3 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-brand" />
        Mis pedidos
      </h1>
      <p className="mb-6 mt-1 pl-4 text-sm text-muted-foreground">
        Historial de tus compras y estado de los envíos.
      </p>

      {/* El cliente llega aquí desde la pasarela cuando no se pudo verificar la
          transacción. Antes aterrizaba en esta lista sin ninguna explicación. */}
      {pago === "sin-confirmar" && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-xl border border-deal/50 bg-deal/10 p-4"
        >
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-deal-ink" />
          <div>
            <h2 className="font-heading font-semibold">
              No pudimos confirmar el pago todavía
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Volviste de la pasarela, pero no logramos leer el estado de la
              transacción. Busca tu pedido en la lista: si aparece pendiente,
              puedes pagarlo desde su detalle; si ya aparece pagado, no tienes
              que hacer nada más.
            </p>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Aún no tienes pedidos"
          hint="Cuando completes una compra, aparecerá aquí con su estado y su rastreo."
          action={
            <Link href="/" className={cn(buttonVariants())}>
              Empezar a comprar
            </Link>
          }
        />
      ) : (
        <>
          {/* Móvil: una tarjeta por pedido. La tabla de seis columnas obligaba
              a arrastrar la pantalla de lado para llegar al total. */}
          <ul className="space-y-3 md:hidden">
            {orders.map((o) => (
              <li
                key={o.code}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/orders/${o.code}`} className={cn(linkClass, "font-mono")}>
                      {o.code}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {o.date} ·{" "}
                      {o.items === 1 ? "1 artículo" : `${o.items} artículos`}
                    </p>
                  </div>
                  <StatusBadge
                    status={ORDER_STATUS_LABEL[o.status] ?? o.status}
                  />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
                  <span className="font-heading text-base font-bold tabular-nums">
                    {formatPrice(o.total)}
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    {o.trackingUrl && (
                      <a
                        href={o.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Rastrear el pedido ${o.code} (se abre en otra pestaña)`}
                        className={cn(linkClass, "inline-flex items-center gap-1")}
                      >
                        Rastrear <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    )}
                    <Link href={`/orders/${o.code}`} className={linkClass}>
                      Ver detalle
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Escritorio: la tabla, que aquí sí cabe entera. */}
          <div className="hidden rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Pedido</TableHead>
                  <TableHead scope="col">Fecha</TableHead>
                  <TableHead scope="col" className="text-right">
                    Artículos
                  </TableHead>
                  <TableHead scope="col">Estado</TableHead>
                  <TableHead scope="col" className="text-right">
                    Total
                  </TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.code}>
                    <TableCell className="font-mono font-medium">{o.code}</TableCell>
                    <TableCell className="text-muted-foreground">{o.date}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.items}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={ORDER_STATUS_LABEL[o.status] ?? o.status}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatPrice(o.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-4">
                        {o.trackingUrl && (
                          <a
                            href={o.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Rastrear el pedido ${o.code} (se abre en otra pestaña)`}
                            className={cn(
                              linkClass,
                              "inline-flex items-center gap-1 text-sm",
                            )}
                          >
                            Rastrear <ExternalLink aria-hidden className="size-3.5" />
                          </a>
                        )}
                        <Link
                          href={`/orders/${o.code}`}
                          aria-label={`Ver el detalle del pedido ${o.code}`}
                          className={cn(linkClass, "text-sm")}
                        >
                          Ver
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
