import { CreditCard, CheckCircle2, Clock, RotateCcw, Download } from "lucide-react";
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
import { PageHeading } from "@/components/admin/page-heading";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatPrice } from "@/lib/format";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/order-status";
import { listAdminPayments } from "@/lib/server/admin/orders";

export default async function AdminPaymentsPage() {
  const payments = await listAdminPayments();

  const sum = (status: string) =>
    payments
      .filter((p) => p.status === status)
      .reduce((s, p) => s + p.amount, 0);

  const cards = [
    { label: "Cobrado", value: formatPrice(sum("COMPLETED")), icon: CheckCircle2, tint: "text-emerald-600" },
    { label: "Pendiente", value: formatPrice(sum("PENDING")), icon: Clock, tint: "text-amber-600" },
    { label: "Reembolsado", value: formatPrice(sum("REFUNDED")), icon: RotateCcw, tint: "text-slate-500" },
    { label: "Transacciones", value: payments.length.toString(), icon: CreditCard, tint: "text-primary" },
  ];

  return (
    <div>
      <PageHeading title="Pagos" description="Transacciones y estado de cobros (datos en vivo)">
        <a
          href="/api/admin/payments/export"
          download
          className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2")}
        >
          <Download className="size-4" />
          Exportar CSV
        </a>
      </PageHeading>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <c.icon className={cn("size-4", c.tint)} />
              {c.label}
            </div>
            <p className="mt-2 font-heading text-xl font-bold tabular-nums">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{p.orderCode}</TableCell>
                <TableCell>{p.userName}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CreditCard className="size-3.5" />
                    {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.date}</TableCell>
                <TableCell>
                  <StatusBadge status={PAYMENT_STATUS_LABEL[p.status] ?? p.status} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatPrice(p.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
