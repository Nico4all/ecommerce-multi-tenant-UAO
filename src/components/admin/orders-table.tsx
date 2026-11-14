"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/status-badge";
import { SearchField } from "@/components/admin/search-field";
import { formatPrice } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/order-status";
import type {
  AdminOrderRow,
  AdminOrderStatus,
} from "@/lib/server/admin/orders";

const filters: { key: AdminOrderStatus | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "PENDING", label: "Pendientes" },
  { key: "PAID", label: "Pagados" },
  { key: "PACKING", label: "Empacando" },
  { key: "SHIPPED", label: "Enviados" },
  { key: "IN_TRANSIT", label: "En camino" },
  { key: "DELIVERED", label: "Entregados" },
  { key: "CANCELLED", label: "Cancelados" },
];

export function OrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  const [tab, setTab] = React.useState<AdminOrderStatus | "todos">("todos");
  const [q, setQ] = React.useState("");

  const filtered = orders.filter((o) => {
    const matchesTab = tab === "todos" || o.status === tab;
    const matchesQ =
      !q ||
      o.code.toLowerCase().includes(q.toLowerCase()) ||
      o.userName.toLowerCase().includes(q.toLowerCase());
    return matchesTab && matchesQ;
  });

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Filtros por estado */}
      <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
        {filters.map((f) => {
          const count =
            f.key === "todos"
              ? orders.length
              : orders.filter((o) => o.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setTab(f.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === f.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f.label}
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-4">
        <SearchField
          label="Buscar pedidos por código o cliente"
          placeholder="Buscar por código o cliente…"
          value={q}
          onChange={setQ}
          className="max-w-md"
        />
      </div>

      <div className="overflow-x-auto border-t border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Pedido</TableHead>
              <TableHead scope="col">Cliente</TableHead>
              <TableHead scope="col">Fecha</TableHead>
              <TableHead scope="col" className="text-right">
                Artículos
              </TableHead>
              <TableHead scope="col">Método</TableHead>
              <TableHead scope="col">Estado</TableHead>
              <TableHead scope="col" className="text-right">
                Total
              </TableHead>
              <TableHead scope="col" className="w-24">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id} className="group">
                <TableCell className="font-mono font-medium">{o.code}</TableCell>
                <TableCell>{o.userName}</TableCell>
                <TableCell className="text-muted-foreground">{o.date}</TableCell>
                <TableCell className="text-right tabular-nums">{o.items}</TableCell>
                <TableCell className="text-muted-foreground">
                  {PAYMENT_METHOD_LABEL[o.method] ?? o.method}
                </TableCell>
                <TableCell>
                  <StatusBadge status={ORDER_STATUS_LABEL[o.status] ?? o.status} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatPrice(o.total)}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    aria-label={`Gestionar el pedido ${o.code}`}
                    className="rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Gestionar
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length === 0 && (
          <p className="py-14 text-center text-sm text-muted-foreground">
            No hay pedidos en este estado.
          </p>
        )}
      </div>
    </div>
  );
}
