import Link from "next/link";
import {
  DollarSign,
  ShoppingBag,
  Users,
  Receipt,
  TrendingUp,
  AlertCircle,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/admin/stat-card";
import { SalesChart } from "@/components/admin/sales-chart";
import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeading } from "@/components/admin/page-heading";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { getAdminStats } from "@/lib/server/admin/stats";

export default async function AdminOverviewPage() {
  const stats = await getAdminStats();
  const maxCount = Math.max(...stats.topCategories.map((c) => c.count), 1);

  return (
    <div>
      <PageHeading title="Resumen" description="Vista general de tu tienda (datos en vivo)">
        <a
          href="/api/admin/orders/export"
          download
          className={cn(buttonVariants({ size: "default" }), "h-9 gap-2")}
        >
          <Download className="size-4" />
          Exportar pedidos
        </a>
      </PageHeading>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Ingresos"
          value={formatPrice(stats.revenue)}
          icon={DollarSign}
        />
        <StatCard
          label="Ganancia"
          value={formatPrice(stats.profit)}
          icon={TrendingUp}
        />
        <StatCard
          label="Pedidos"
          value={stats.ordersCount.toLocaleString("es-CO")}
          icon={ShoppingBag}
        />
        <StatCard
          label="Clientes"
          value={stats.customersCount.toLocaleString("es-CO")}
          icon={Users}
        />
        <StatCard
          label="Ticket promedio"
          value={formatPrice(stats.avgOrder)}
          icon={Receipt}
        />
      </div>

      {stats.productsWithoutCost > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            {stats.productsWithoutCost} producto(s) publicado(s) sin precio de costo.
            La ganancia solo cuenta los que ya lo tienen — cárgalo en cada producto
            para que el cálculo sea completo.
          </span>
        </div>
      )}

      {/* Gráfico + categorías */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-heading font-semibold">Pedidos</h2>
            <p className="text-xs text-muted-foreground">
              Pedidos por día · últimos 12 días
            </p>
          </div>
          <SalesChart series={stats.salesSeries} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-heading font-semibold">Top categorías</h2>
          <ul className="space-y-3">
            {stats.topCategories.map((c) => (
              <li key={c.slug}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">{c.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(c.count / maxCount) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Pedidos recientes */}
      <div className="mt-4 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-heading font-semibold">Pedidos recientes</h2>
          <Link
            href="/admin/orders"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver pedidos
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/orders/${o.id}`} className="hover:text-primary">
                      {o.code}
                    </Link>
                  </TableCell>
                  <TableCell>{o.userName}</TableCell>
                  <TableCell className="text-muted-foreground">{o.date}</TableCell>
                  <TableCell>
                    <StatusBadge status={ORDER_STATUS_LABEL[o.status] ?? o.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(o.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
