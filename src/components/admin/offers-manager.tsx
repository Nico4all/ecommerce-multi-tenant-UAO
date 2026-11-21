"use client";

import * as React from "react";
import { Percent, Tag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SearchField } from "@/components/admin/search-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductImage } from "@/components/product/product-image";
import { formatPrice } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import type { AdminProductRow } from "@/lib/server/admin/products";
import type { CategorySlug } from "@/types";

interface RowState {
  offerActive: boolean;
  offerPrice: string; // input controlado
}

export function OffersManager({ products }: { products: AdminProductRow[] }) {
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [state, setState] = React.useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      products.map((p) => [
        p.id,
        {
          offerActive: p.offerActive,
          offerPrice: p.offerPrice !== null
            ? String(p.offerPrice)
            : String(Math.round(p.price * 0.85)),
        },
      ]),
    ),
  );

  const setRow = (id: string, patch: Partial<RowState>) =>
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const persist = async (p: AdminProductRow, next: RowState) => {
    setBusy(p.id);
    try {
      const updated = await api.patch<AdminProductRow>(
        `/api/admin/products/${p.id}/offer`,
        {
          offerActive: next.offerActive,
          offerPrice: next.offerPrice ? Number(next.offerPrice) : null,
        },
      );
      setRow(p.id, {
        offerActive: updated.offerActive,
        offerPrice: updated.offerPrice !== null ? String(updated.offerPrice) : "",
      });
      toast.success(
        updated.offerActive
          ? `Oferta activada en "${p.name}"`
          : `Oferta desactivada en "${p.name}"`,
      );
    } catch (e) {
      // revertir al estado del servidor
      setRow(p.id, {
        offerActive: p.offerActive,
        offerPrice: p.offerPrice !== null ? String(p.offerPrice) : "",
      });
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo guardar la oferta",
      );
    } finally {
      setBusy(null);
    }
  };

  const toggle = (p: AdminProductRow, active: boolean) => {
    const next = { ...state[p.id], offerActive: active };
    setRow(p.id, { offerActive: active });
    persist(p, next);
  };

  const commitPrice = (p: AdminProductRow) => {
    const st = state[p.id];
    if (!st.offerActive) return; // solo guarda si la oferta está activa
    persist(p, st);
  };

  const filtered = products.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.brand.toLowerCase().includes(q.toLowerCase()),
  );

  const active = products.filter((p) => state[p.id]?.offerActive);
  const avgDiscount =
    active.length === 0
      ? 0
      : Math.round(
          active.reduce((sum, p) => {
            const off = Number(state[p.id].offerPrice) || p.price;
            return sum + ((p.price - off) / p.price) * 100;
          }, 0) / active.length,
        );

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="size-4 text-deal-ink" /> Productos en oferta
          </div>
          <p className="mt-2 font-heading text-2xl font-bold tabular-nums">
            {active.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Percent className="size-4 text-deal-ink" /> Descuento promedio
          </div>
          <p className="mt-2 font-heading text-2xl font-bold tabular-nums">
            {avgDiscount}%
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-border bg-card p-4 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="size-4 text-muted-foreground" /> Catálogo total
          </div>
          <p className="mt-2 font-heading text-2xl font-bold tabular-nums">
            {products.length}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="p-4">
          <SearchField
            label="Buscar productos para poner en oferta"
            placeholder="Buscar producto…"
            value={q}
            onChange={setQ}
            className="max-w-md"
          />
        </div>

        <div className="overflow-x-auto border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Precio original</TableHead>
                <TableHead className="text-right">Precio de oferta</TableHead>
                <TableHead className="text-right">Descuento</TableHead>
                <TableHead className="text-center">En oferta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const st = state[p.id];
                const offerNum = Number(st.offerPrice) || 0;
                const pct = st.offerActive && offerNum > 0
                  ? Math.max(0, Math.round(((p.price - offerNum) / p.price) * 100))
                  : 0;
                return (
                  <TableRow key={p.id} className={cn(!st.offerActive && "opacity-70")}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProductImage
                          src={p.imageUrl}
                          category={p.category as CategorySlug}
                          name={p.name}
                          className="size-10 shrink-0 rounded-md border border-border"
                        />
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.brand}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(p.price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={st.offerPrice}
                        disabled={!st.offerActive || busy === p.id}
                        onChange={(e) => setRow(p.id, { offerPrice: e.target.value })}
                        onBlur={() => commitPrice(p)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && (e.target as HTMLInputElement).blur()
                        }
                        className="ml-auto h-8 w-28 text-right tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {st.offerActive ? (
                        <span className="font-semibold text-deal-ink tabular-nums">
                          -{pct}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {busy === p.id && (
                          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          checked={st.offerActive}
                          disabled={busy !== null}
                          onCheckedChange={(v) => toggle(p, v === true)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
