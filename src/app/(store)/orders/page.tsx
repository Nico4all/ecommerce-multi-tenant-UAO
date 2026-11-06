import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageSearch, ExternalLink } from "lucide-react";
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
import { getSession } from "@/lib/server/auth";
import { getMyOrders } from "@/lib/server/orders";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";

export const metadata: Metadata = {
  title: "Mis pedidos — Variedades Los Primos",
};

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/orders");

  const orders = await getMyOrders();

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Mis pedidos
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Historial de tus compras y estado de los envíos.
      </p>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <PackageSearch className="size-12 text-muted-foreground/50" strokeWidth={1.25} />
          <h2 className="mt-4 font-heading text-xl font-semibold">
            Aún no tienes pedidos
          </h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Cuando completes una compra, aparecerá aquí con su rastreo.
          </p>
          <Link href="/" className={cn(buttonVariants(), "mt-5")}>
            Empezar a comprar
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Artículos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.code} className="group">
                  <TableCell className="font-medium">{o.code}</TableCell>
                  <TableCell className="text-muted-foreground">{o.date}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.items}</TableCell>
                  <TableCell>
                    <StatusBadge status={ORDER_STATUS_LABEL[o.status] ?? o.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatPrice(o.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      {o.trackingUrl && (
                        <a
                          href={o.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Rastrear <ExternalLink className="size-3" />
                        </a>
                      )}
                      <Link
                        href={`/orders/${o.code}`}
                        className="text-sm font-medium text-primary hover:underline"
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
      )}
    </div>
  );
}
