"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  IdCard,
  Package,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormSelect } from "@/components/admin/form-select";
import { KIND_LABEL, STATUS_LABEL } from "@/lib/support-form";
import { api, ApiClientError } from "@/lib/api-client";
import type { SupportMessageDTO, SupportStatus } from "@/lib/server/support";

const STATUSES: SupportStatus[] = ["NUEVO", "EN_PROCESO", "RESUELTO", "CERRADO"];

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
});

/** Días hábiles transcurridos, para no pasarse del plazo legal de una PQR. */
function businessDaysSince(iso: string): number {
  let days = 0;
  const cursor = new Date(iso);
  const now = new Date();
  while (cursor < now) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) days++;
  }
  return days;
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="min-w-0 break-words font-medium">{children}</span>
    </div>
  );
}

export function SupportDetail({ message }: { message: SupportMessageDTO }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<SupportStatus>(message.status);
  const [response, setResponse] = React.useState(message.response ?? "");
  const [saving, setSaving] = React.useState(false);

  const isPqr = message.kind !== "CONTACTO";
  const elapsed = businessDaysSince(message.createdAt);
  const late = isPqr && elapsed > 15 && status !== "RESUELTO" && status !== "CERRADO";

  // Se enviará correo solo si hay una respuesta nueva o distinta a la guardada
  // (misma condición que aplica el servidor). Guía el texto del botón.
  const willEmail =
    response.trim() !== "" && response.trim() !== (message.response ?? "").trim();

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/admin/support/${message.id}`, { status, response });
      toast.success("Mensaje actualizado");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo guardar",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/mensajes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a Mensajes y PQR
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold tracking-tight">
          {message.radicado}
        </h1>
        <StatusBadge
          status={STATUS_LABEL[message.status].toLowerCase().replace(" ", "_")}
        />
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {KIND_LABEL[message.kind]}
        </span>
      </div>

      {late && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            Esta PQR lleva <strong>{elapsed} días hábiles</strong> sin resolverse.
            El plazo legal de respuesta en Colombia es de 15 días hábiles.
          </p>
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-medium">{message.subject}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {message.message}
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-medium">Quién escribe</h2>
        <div className="space-y-2">
          <Row icon={Mail} label="Nombre">
            {message.name}
          </Row>
          <Row icon={Mail} label="Correo">
            <a href={`mailto:${message.email}`} className="text-primary hover:underline">
              {message.email}
            </a>
          </Row>
          {message.phone && (
            <Row icon={Phone} label="Teléfono">
              {message.phone}
            </Row>
          )}
          {message.docId && (
            <Row icon={IdCard} label="Documento">
              {message.docId}
            </Row>
          )}
          {message.orderCode && (
            <Row icon={Package} label="Pedido">
              {message.orderCode}
            </Row>
          )}
          <Row icon={Clock} label="Recibido">
            {dateFmt.format(new Date(message.createdAt))}
            <span className="ml-1 font-normal text-muted-foreground">
              ({elapsed} día{elapsed === 1 ? "" : "s"} hábil{elapsed === 1 ? "" : "es"})
            </span>
          </Row>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-medium">Gestión</h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sup-status">Estado</Label>
            <FormSelect
              id="sup-status"
              value={status}
              onChange={(v) => setStatus(v as SupportStatus)}
              options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-response">Respuesta</Label>
            <Textarea
              id="sup-response"
              rows={6}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Escribe aquí la respuesta que le diste al cliente…"
            />
            <p className="text-xs text-muted-foreground">
              Al guardar, esta respuesta se le <strong>envía por correo</strong> al
              cliente (a {message.email}) y queda registrada aquí. Solo se envía si
              escribiste algo nuevo o distinto: cambiar solo el estado no manda correo.
            </p>
          </div>

          {message.respondedAt && (
            <p className="text-xs text-muted-foreground">
              Primera respuesta registrada el{" "}
              {dateFmt.format(new Date(message.respondedAt))}.
            </p>
          )}
        </div>
      </section>

      <div className="mt-4 flex justify-end gap-2 pb-10">
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          {willEmail ? "Guardar y enviar respuesta" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
