"use client";

import * as React from "react";
import {
  Check,
  Truck,
  Link2,
  Mail,
  MapPin,
  Phone,
  CreditCard,
  Package,
  ArrowRight,
  Send,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/admin/form-select";
import { Thumb } from "@/components/product/thumb";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatPrice } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/order-status";
import type {
  AdminOrderDetail,
  AdminOrderStatus,
} from "@/lib/server/admin/orders";

const STEPS: { key: AdminOrderStatus; label: string }[] = [
  { key: "PAID", label: "Pagado" },
  { key: "PACKING", label: "Empacando" },
  { key: "SHIPPED", label: "Enviado" },
  { key: "IN_TRANSIT", label: "En camino" },
  { key: "DELIVERED", label: "Entregado" },
];

export function OrderManage({ order: initial }: { order: AdminOrderDetail }) {
  const [order, setOrder] = React.useState(initial);
  const [carrier, setCarrier] = React.useState(initial.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = React.useState(
    initial.trackingNumber ?? "",
  );
  const [trackingUrl, setTrackingUrl] = React.useState(initial.trackingUrl ?? "");
  const [includeTracking, setIncludeTracking] = React.useState(true);
  const [busy, setBusy] = React.useState<
    "status" | "tracking" | "email" | "verify" | null
  >(null);
  const [savedTracking, setSavedTracking] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);

  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === "CANCELLED";
  const nextStep = STEPS[currentIndex + 1];

  const setStatus = async (status: AdminOrderStatus) => {
    setBusy("status");
    try {
      const updated = await api.patch<AdminOrderDetail>(
        `/api/admin/orders/${order.id}`,
        { status },
      );
      setOrder(updated);
      toast.success(
        `Pedido marcado como "${ORDER_STATUS_LABEL[status].replace("_", " ")}"`,
      );
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo cambiar el estado",
      );
    } finally {
      setBusy(null);
    }
  };

  const saveTracking = async () => {
    setBusy("tracking");
    try {
      const updated = await api.patch<AdminOrderDetail>(
        `/api/admin/orders/${order.id}`,
        {
          carrier: carrier || null,
          trackingNumber: trackingNumber || null,
          trackingUrl: trackingUrl || null,
        },
      );
      setOrder(updated);
      setSavedTracking(true);
      setTimeout(() => setSavedTracking(false), 1800);
      toast.success("Rastreo guardado");
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo guardar el rastreo",
      );
    } finally {
      setBusy(null);
    }
  };

  const sendEmail = async () => {
    setBusy("email");
    try {
      const res = await api.post<{ to: string }>(
        `/api/admin/orders/${order.id}/email`,
        { includeTracking },
      );
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 2500);
      setOrder((o) => ({ ...o, emailsSent: o.emailsSent + 1 }));
      toast.success(`Correo enviado a ${res.to}`);
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo enviar el correo",
      );
    } finally {
      setBusy(null);
    }
  };

  /**
   * Le pregunta a Wompi el estado real del pago y concilia el pedido.
   * Red de seguridad para cuando no llegó el webhook ni volvió el cliente:
   * sin esto, un pedido pagado se queda en "Pendiente" indefinidamente.
   */
  const verifyPayment = async () => {
    setBusy("verify");
    try {
      const res = await api.post<{
        found: number;
        transactionStatus: string | null;
        orderStatus: string;
        changed: boolean;
      }>(`/api/admin/orders/${order.id}/verify-payment`);

      if (res.found === 0) {
        toast.warning(
          "Wompi no tiene ninguna transacción para este pedido: el cliente nunca llegó a pagar.",
        );
        return;
      }
      if (res.changed) {
        // Se recarga el pedido completo para que el badge, el pipeline y el
        // contador de correos reflejen todo lo que cambió la conciliación.
        setOrder(
          await api.get<AdminOrderDetail>(`/api/admin/orders/${order.id}`),
        );
        toast.success(
          `Wompi reporta ${res.transactionStatus}: el pedido pasó a "${
            ORDER_STATUS_LABEL[res.orderStatus as AdminOrderStatus] ??
            res.orderStatus
          }".`,
        );
      } else {
        toast.info(
          `Sin cambios: Wompi reporta ${res.transactionStatus} y el pedido ya estaba al día.`,
        );
      }
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo verificar el pago",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Columna principal */}
      <div className="space-y-4 lg:col-span-2">
        {/* Pipeline de estado */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-heading font-semibold">Estado del pedido</h2>
            <div className="flex items-center gap-2">
              <FormSelect
                value={order.status}
                onChange={(v) => v && setStatus(v as AdminOrderStatus)}
                disabled={busy !== null}
                className="h-8 w-40"
                options={[
                  { value: "PENDING", label: "Pendiente" },
                  ...STEPS.map((s) => ({ value: s.key, label: s.label })),
                  { value: "CANCELLED", label: "Cancelado" },
                ]}
              />
              {nextStep && !isCancelled && (
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={busy !== null}
                  onClick={() => setStatus(nextStep.key)}
                >
                  {busy === "status" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      {nextStep.label}
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {isCancelled ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
              Este pedido fue cancelado.
            </div>
          ) : (
            <ol className="flex items-center">
              {STEPS.map((s, i) => {
                const done = i <= currentIndex;
                const active = i === currentIndex;
                return (
                  <li key={s.key} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          "grid size-8 place-items-center rounded-full border-2 transition-colors",
                          done
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground",
                          active && "ring-4 ring-primary/15",
                        )}
                      >
                        {done ? <Check className="size-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                      </span>
                      <span className={cn("text-[11px] font-medium", done ? "text-foreground" : "text-muted-foreground")}>
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <span className={cn("mx-1 h-0.5 flex-1", i < currentIndex ? "bg-primary" : "bg-border")} />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Artículos pedidos */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-heading font-semibold">
            <Package className="size-4 text-primary" />
            Artículos ({order.lines.length})
          </h2>
          <ul className="divide-y divide-border">
            {order.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Thumb
                  category={l.category ?? "hogar"}
                  seed={l.name}
                  className="size-12 shrink-0 rounded-md border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.brand}
                    {l.variantName ? ` · ${l.variantName}` : ""} · Cant. {l.qty}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatPrice(l.unitPrice * l.qty)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
            <span className="font-medium">Total del pedido</span>
            <span className="font-heading font-bold tabular-nums">
              {formatPrice(order.total)}
            </span>
          </div>
        </section>

        {/* Rastreo del envío */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-heading font-semibold">
            <Truck className="size-4 text-primary" />
            Envío y rastreo
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="carrier">Paquetería</Label>
              <FormSelect
                id="carrier"
                value={carrier}
                onChange={setCarrier}
                placeholder="Selecciona…"
                options={[
                  { value: "Servientrega", label: "Servientrega" },
                  { value: "Coordinadora", label: "Coordinadora" },
                  { value: "Interrapidísimo", label: "Interrapidísimo" },
                  { value: "TCC", label: "TCC" },
                  { value: "Envía", label: "Envía Colvanes" },
                  { value: "DHL", label: "DHL (internacional)" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tnumber">Número de guía</Label>
              <Input
                id="tnumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Ej. SER2938471CO"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="turl">Enlace de rastreo (lo verá el cliente)</Label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="turl"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://paqueteria.com/rastreo?guia=…"
                  className="pl-9"
                />
              </div>
              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Probar enlace <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={saveTracking} disabled={busy !== null}>
              {busy === "tracking" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : savedTracking ? (
                <>
                  <Check className="size-4" /> Guardado
                </>
              ) : (
                "Guardar rastreo"
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              El enlace se incluye en el correo al cliente.
            </span>
          </div>
        </section>
      </div>

      {/* Aside */}
      <aside className="space-y-4">
        {/* Resumen */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold">{order.code}</h2>
            <StatusBadge status={ORDER_STATUS_LABEL[order.status] ?? order.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Realizado el {order.date}</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-sm">
            <CreditCard className="size-4 text-muted-foreground" />
            {PAYMENT_METHOD_LABEL[order.method] ?? order.method} ·{" "}
            <span className="font-medium">{formatPrice(order.total)}</span>
          </div>

          {/* Conciliación manual: solo tiene sentido con la pasarela. */}
          {order.method === "WOMPI" && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={verifyPayment}
                disabled={busy !== null}
              >
                {busy === "verify" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Verificar pago con Wompi
              </Button>
              {order.status === "PENDING" && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Este pedido figura sin pagar. Si el cliente dice que sí pagó,
                  pulsa aquí: se le pregunta a Wompi y, si el pago está
                  aprobado, el pedido se confirma y le llega su correo.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Cliente y envío */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
            <MapPin className="size-4 text-primary" />
            Enviar a
          </h2>
          <address className="space-y-0.5 text-sm not-italic text-muted-foreground">
            <p className="font-medium text-foreground">{order.customer.name}</p>
            <p>{order.customer.street}</p>
            <p>
              {order.customer.city}, {order.customer.state} {order.customer.zip}
            </p>
            <p>{order.customer.country}</p>
            <p className="flex items-center gap-1.5 pt-1">
              <Phone className="size-3.5" /> {order.customer.phone}
            </p>
            <p className="flex items-center gap-1.5">
              <Mail className="size-3.5" /> {order.customer.email}
            </p>
          </address>
        </section>

        {/* Correo al cliente */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
            <Mail className="size-4 text-primary" />
            Correo al cliente
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Se enviará el historial de la compra y el enlace de rastreo a{" "}
            <span className="font-medium text-foreground">{order.customer.email}</span>
            {order.emailsSent > 0 && (
              <> · {order.emailsSent} enviado{order.emailsSent === 1 ? "" : "s"}</>
            )}
            .
          </p>

          {/* Vista previa del correo */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <p className="font-semibold text-foreground">Tu pedido {order.code}</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {order.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="line-clamp-1">
                    {l.qty}× {l.name}
                  </span>
                  <span className="tabular-nums">{formatPrice(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-medium text-foreground">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(order.total)}</span>
            </div>
            {includeTracking && trackingUrl && (
              <p className="mt-2 flex items-center gap-1 text-primary">
                <Link2 className="size-3" /> Rastrear mi paquete
              </p>
            )}
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeTracking}
              onChange={(e) => setIncludeTracking(e.target.checked)}
              className="size-4 accent-primary"
            />
            Incluir enlace de rastreo
          </label>

          <Button
            className="mt-3 w-full gap-2"
            variant={emailSent ? "secondary" : "default"}
            onClick={sendEmail}
            disabled={busy !== null}
          >
            {busy === "email" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Enviando…
              </>
            ) : emailSent ? (
              <>
                <Check className="size-4" /> Correo enviado
              </>
            ) : (
              <>
                <Send className="size-4" /> Enviar correo al cliente
              </>
            )}
          </Button>
        </section>
      </aside>
    </div>
  );
}
