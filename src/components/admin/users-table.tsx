"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, UsersRound } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormSelect } from "@/components/admin/form-select";
import { SearchField } from "@/components/admin/search-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatPrice } from "@/lib/format";
import type { AdminUserRow } from "@/lib/server/admin/users";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState<"all" | "ADMIN" | "CUSTOMER">("all");

  const filtered = users.filter((u) => {
    const term = q.trim().toLowerCase();
    const matchesQ =
      !term ||
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.city.toLowerCase().includes(term) ||
      u.state.toLowerCase().includes(term);
    const matchesRole = role === "all" || u.role === role;
    return matchesQ && matchesRole;
  });

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <SearchField
          label="Buscar usuarios por nombre, correo o ciudad"
          placeholder="Buscar por nombre, correo o ciudad…"
          value={q}
          onChange={setQ}
          className="flex-1"
        />
        <FormSelect
          value={role}
          onChange={(v) => setRole((v as typeof role) || "all")}
          className="w-full sm:w-48"
          options={[
            { value: "all", label: "Todos los roles" },
            { value: "CUSTOMER", label: "Clientes" },
            { value: "ADMIN", label: "Administradores" },
          ]}
        />
      </div>

      <div className="overflow-x-auto border-t border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Cliente</TableHead>
              <TableHead scope="col">Ubicación</TableHead>
              <TableHead scope="col" className="text-right">
                Pedidos
              </TableHead>
              <TableHead scope="col" className="text-right">
                Total gastado
              </TableHead>
              <TableHead scope="col">Estado</TableHead>
              <TableHead scope="col" className="w-14">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {u.name}
                        </Link>
                        {u.role === "ADMIN" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                            <ShieldCheck className="size-3" />
                            Admin
                          </span>
                        )}
                      </span>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.city}, {u.state}
                </TableCell>
                <TableCell className="text-right tabular-nums">{u.orders}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPrice(u.totalSpent)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={u.status === "ACTIVE" ? "activo" : "inactivo"} />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/users/${u.id}`}
                    aria-label={`Ver la ficha de ${u.name}`}
                    className="rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Ver
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length === 0 && (
          <div role="status" className="flex flex-col items-center gap-1 py-16 text-center">
            <UsersRound aria-hidden strokeWidth={1.25} className="size-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              No hay usuarios que coincidan con tu búsqueda.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {filtered.length} de {users.length} usuarios
        </span>
      </div>
    </div>
  );
}
