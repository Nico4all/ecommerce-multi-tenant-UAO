"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeading } from "@/components/admin/page-heading";
import { KIND_LABEL, STATUS_LABEL } from "@/lib/support-form";
import type { SupportMessageDTO, SupportStatus } from "@/lib/server/support";

const TABS: { key: SupportStatus | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "NUEVO", label: "Nuevos" },
  { key: "EN_PROCESO", label: "En proceso" },
  { key: "RESUELTO", label: "Resueltos" },
  { key: "CERRADO", label: "Cerrados" },
];

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function SupportInbox({ messages }: { messages: SupportMessageDTO[] }) {
  const [tab, setTab] = React.useState<SupportStatus | "todos">("todos");
  const [q, setQ] = React.useState("");

  const filtered = messages.filter((m) => {
    const matchesTab = tab === "todos" || m.status === tab;
    const needle = q.toLowerCase();
    const matchesQ =
      !q ||
      m.radicado.toLowerCase().includes(needle) ||
      m.name.toLowerCase().includes(needle) ||
      m.email.toLowerCase().includes(needle) ||
      m.subject.toLowerCase().includes(needle);
    return matchesTab && matchesQ;
  });

  return (
    <div>
      <PageHeading
        title="Mensajes y PQR"
        description="Peticiones, quejas, reclamos y mensajes de contacto de la tienda"
      />

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border p-2 sm:flex-row sm:items-center">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const count =
                t.key === "todos"
                  ? messages.length
                  : messages.filter((m) => m.status === t.key).length;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span className="ml-1.5 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Radicado, nombre o asunto…"
              className="pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="size-10 text-muted-foreground/50" strokeWidth={1.25} />
            <p className="mt-3 text-sm text-muted-foreground">
              {messages.length === 0
                ? "Todavía no ha llegado ningún mensaje."
                : "Ningún mensaje coincide con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Radicado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Recibido</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id} className="cursor-pointer">
                    <TableCell className="font-mono text-xs font-medium">
                      <Link href={`/admin/mensajes/${m.id}`} className="hover:underline">
                        {m.radicado}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{KIND_LABEL[m.kind]}</TableCell>
                    <TableCell className="text-sm">
                      <span className="block max-w-40 truncate font-medium">
                        {m.name}
                      </span>
                      <span className="block max-w-40 truncate text-xs text-muted-foreground">
                        {m.email}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-sm">
                      <Link href={`/admin/mensajes/${m.id}`} className="hover:underline">
                        {m.subject}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateFmt.format(new Date(m.createdAt))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={STATUS_LABEL[m.status].toLowerCase().replace(" ", "_")} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
