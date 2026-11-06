"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Ticket,
  CreditCard,
  Truck,
  Percent,
  Copy,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormSelect } from "@/components/admin/form-select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatPrice } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import type { AdminDiscountRow } from "@/lib/server/admin/discounts";

type DiscountType = AdminDiscountRow["type"];
type DiscountStatus = AdminDiscountRow["status"];

const typeMeta: Record<DiscountType, { label: string; icon: typeof Percent }> = {
  PERCENT: { label: "Porcentaje", icon: Percent },
  FIXED: { label: "Monto fijo", icon: Ticket },
  FREE_SHIPPING: { label: "Envío gratis", icon: Truck },
  GIFT_CARD: { label: "Tarjeta de regalo", icon: CreditCard },
};

const statusLabel: Record<DiscountStatus, string> = {
  ACTIVE: "activo",
  SCHEDULED: "programado",
  EXPIRED: "expirado",
  DISABLED: "inactivo",
};

function valueLabel(type: DiscountType, value: number) {
  switch (type) {
    case "PERCENT":
      return value ? `${value}%` : "—";
    case "FIXED":
    case "GIFT_CARD":
      return value ? formatPrice(value) : "—";
    case "FREE_SHIPPING":
      return "Envío gratis";
  }
}

interface FormState {
  code: string;
  type: DiscountType;
  value: string;
  minPurchase: string;
  limit: string;
  startDate: string;
  expires: string;
  status: DiscountStatus;
  description: string;
}

const emptyForm: FormState = {
  code: "",
  type: "PERCENT",
  value: "",
  minPurchase: "",
  limit: "",
  startDate: "",
  expires: "",
  status: "ACTIVE",
  description: "",
};

export function DiscountsManager({ codes }: { codes: AdminDiscountRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const isEdit = editingId !== null;
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (d: AdminDiscountRow) => {
    setEditingId(d.id);
    setForm({
      code: d.code,
      type: d.type,
      value: d.value ? String(d.value) : "",
      minPurchase: d.minPurchase !== null ? String(d.minPurchase) : "",
      limit: d.usageLimit !== null ? String(d.usageLimit) : "",
      startDate: d.startsAt ?? "",
      expires: d.expiresAt ?? "",
      status: d.status,
      description: d.description ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      code: form.code,
      type: form.type,
      value: form.value ? Number(form.value) : 0,
      minPurchase: form.minPurchase ? Number(form.minPurchase) : null,
      usageLimit: form.limit ? Number(form.limit) : null,
      status: form.status,
      startsAt: form.startDate || null,
      expiresAt: form.expires || null,
      description: form.description || null,
    };
    try {
      if (isEdit) {
        await api.patch(`/api/admin/discounts/${editingId}`, payload);
        toast.success("Descuento actualizado");
      } else {
        await api.post("/api/admin/discounts", payload);
        toast.success(`Código ${payload.code.toUpperCase()} creado`);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo guardar el descuento",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: AdminDiscountRow) => {
    setDeleting(d.id);
    try {
      await api.delete(`/api/admin/discounts/${d.id}`);
      toast.success(`Código ${d.code} eliminado`);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo eliminar el descuento",
      );
    } finally {
      setDeleting(null);
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success(`"${code}" copiado`);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            Descuentos
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Códigos promocionales y tarjetas de regalo
          </p>
        </div>
        <Button className="h-9 gap-2" onClick={openNew}>
          <Plus className="size-4" />
          Crear descuento
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Usos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((d) => {
              const meta = typeMeta[d.type];
              return (
                <TableRow key={d.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 font-mono text-xs font-semibold">
                        {d.code}
                      </code>
                      <button
                        aria-label="Copiar código"
                        onClick={() => copyCode(d.code)}
                        className="text-muted-foreground opacity-100 transition-opacity hover:text-primary sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <meta.icon className="size-3.5" />
                      {meta.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {valueLabel(d.type, d.value)}
                    {d.type === "GIFT_CARD" && d.balance !== null && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        saldo {formatPrice(d.balance)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {d.usedCount}
                    {d.usageLimit ? ` / ${d.usageLimit}` : ""}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={statusLabel[d.status]} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.expiresAt ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        onClick={() => openEdit(d)}
                        aria-label="Editar"
                        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        aria-label="Eliminar"
                        onClick={() => remove(d)}
                        disabled={deleting !== null}
                        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      >
                        {deleting === d.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Formulario crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar descuento" : "Crear descuento"}
            </DialogTitle>
            <DialogDescription>
              Configura un código promocional o una tarjeta de regalo.
            </DialogDescription>
          </DialogHeader>

          {/* Vista previa tipo ticket */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Ticket className="size-5 text-primary" />
              <code className="font-mono text-sm font-bold tracking-wide">
                {form.code || "TUCODIGO"}
              </code>
            </div>
            <span className="font-heading text-lg font-bold text-primary">
              {valueLabel(form.type, Number(form.value))}
            </span>
          </div>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto py-1 pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-code">Código</Label>
                <Input
                  id="d-code"
                  value={form.code}
                  onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                  placeholder="VERANO2026"
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-type">Tipo</Label>
                <FormSelect
                  id="d-type"
                  value={form.type}
                  onChange={(v) => set({ type: v as DiscountType })}
                  options={[
                    { value: "PERCENT", label: "Porcentaje (%)" },
                    { value: "FIXED", label: "Monto fijo" },
                    { value: "FREE_SHIPPING", label: "Envío gratis" },
                    { value: "GIFT_CARD", label: "Tarjeta de regalo" },
                  ]}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {form.type !== "FREE_SHIPPING" && (
                <div className="space-y-1.5">
                  <Label htmlFor="d-value">
                    {form.type === "PERCENT" ? "Porcentaje de descuento" : "Monto"}
                  </Label>
                  <Input
                    id="d-value"
                    type="number"
                    value={form.value}
                    onChange={(e) => set({ value: e.target.value })}
                    placeholder={form.type === "PERCENT" ? "10" : "200"}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="d-min">Compra mínima (opcional)</Label>
                <Input
                  id="d-min"
                  type="number"
                  value={form.minPurchase}
                  onChange={(e) => set({ minPurchase: e.target.value })}
                  placeholder="Sin mínimo"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-limit">Límite de usos</Label>
                <Input
                  id="d-limit"
                  type="number"
                  value={form.limit}
                  onChange={(e) => set({ limit: e.target.value })}
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-status">Estado</Label>
                <FormSelect
                  id="d-status"
                  value={form.status}
                  onChange={(v) => set({ status: v as DiscountStatus })}
                  options={[
                    { value: "ACTIVE", label: "Activo" },
                    { value: "SCHEDULED", label: "Programado" },
                    { value: "EXPIRED", label: "Expirado" },
                    { value: "DISABLED", label: "Inactivo" },
                  ]}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-start">Inicio</Label>
                <Input
                  id="d-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set({ startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-exp">Expira</Label>
                <Input
                  id="d-exp"
                  type="date"
                  value={form.expires}
                  onChange={(e) => set({ expires: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-desc">Descripción interna (opcional)</Label>
              <Textarea
                id="d-desc"
                rows={2}
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Para qué campaña es este descuento…"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose className={cn(buttonVariants({ variant: "outline" }))}>
              Cancelar
            </DialogClose>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear descuento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
