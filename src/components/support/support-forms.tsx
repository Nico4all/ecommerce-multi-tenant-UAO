"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, Controller, type FieldError } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/admin/form-select";
import {
  pqrFormSchema,
  contactFormSchema,
  KIND_LABEL,
  KIND_HINT,
  PQR_KINDS,
  type PqrFormValues,
  type ContactFormValues,
} from "@/lib/support-form";
import { api, ApiClientError } from "@/lib/api-client";

interface Sent {
  radicado: string;
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error.message}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Acuse de recibo con el radicado, que es lo que el cliente debe guardar. */
function Acuse({ sent, isPqr }: { sent: Sent; isPqr: boolean }) {
  const copy = async () => {
    await navigator.clipboard.writeText(sent.radicado);
    toast.success("Radicado copiado");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center sm:p-10">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="size-6" />
      </span>
      <h2 className="mt-4 font-heading text-xl font-bold">
        {isPqr ? "Radicamos tu PQR" : "Recibimos tu mensaje"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {isPqr
          ? "Guarda este número: con él puedes hacer seguimiento a tu solicitud. Te responderemos al correo que nos dejaste."
          : "Te responderemos al correo que nos dejaste lo antes posible."}
      </p>

      <button
        onClick={copy}
        className="mx-auto mt-5 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 font-mono text-lg font-bold tracking-wide transition-colors hover:border-primary"
      >
        {sent.radicado}
        <Copy className="size-4 text-muted-foreground" />
      </button>

      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          Volver a la tienda
        </Link>
        <Link href="/ayuda" className={cn(buttonVariants())}>
          Centro de ayuda
        </Link>
      </div>
    </div>
  );
}

/** Formulario de PQR (Petición, Queja, Reclamo o Sugerencia). */
export function PqrForm({ defaults }: { defaults: { name: string; email: string } }) {
  const [sent, setSent] = React.useState<Sent | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PqrFormValues>({
    resolver: zodResolver(pqrFormSchema),
    defaultValues: {
      kind: "PETICION",
      name: defaults.name,
      email: defaults.email,
      phone: "",
      docId: "",
      orderCode: "",
      subject: "",
      message: "",
    },
  });

  const kind = watch("kind");

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await api.post<Sent>("/api/support", values);
      setSent(res);
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No pudimos enviar tu PQR",
      );
    }
  });

  if (sent) return <Acuse sent={sent} isPqr />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="space-y-4">
          <Field
            label="¿Qué necesitas?"
            htmlFor="pqr-kind"
            hint={KIND_HINT[kind]}
            error={errors.kind}
          >
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <FormSelect
                  id="pqr-kind"
                  value={field.value}
                  onChange={field.onChange}
                  options={PQR_KINDS.map((k) => ({
                    value: k,
                    label: KIND_LABEL[k],
                  }))}
                />
              )}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" htmlFor="pqr-name" error={errors.name}>
              <Input id="pqr-name" autoComplete="name" {...register("name")} />
            </Field>
            <Field label="Correo" htmlFor="pqr-email" error={errors.email}>
              <Input
                id="pqr-email"
                type="email"
                autoComplete="email"
                {...register("email")}
              />
            </Field>
            <Field label="Teléfono" htmlFor="pqr-phone" optional error={errors.phone}>
              <Input
                id="pqr-phone"
                autoComplete="tel"
                placeholder="+57 301 234 5678"
                {...register("phone")}
              />
            </Field>
            <Field label="Cédula o NIT" htmlFor="pqr-doc" optional error={errors.docId}>
              <Input id="pqr-doc" {...register("docId")} />
            </Field>
          </div>

          <Field
            label="Número de pedido"
            htmlFor="pqr-order"
            optional
            hint="Si tu solicitud es sobre una compra, el código acelera la respuesta."
            error={errors.orderCode}
          >
            <Input id="pqr-order" placeholder="VLP-10241" {...register("orderCode")} />
          </Field>

          <Field label="Asunto" htmlFor="pqr-subject" error={errors.subject}>
            <Input
              id="pqr-subject"
              placeholder="Resumen en una frase"
              {...register("subject")}
            />
          </Field>

          <Field
            label="Cuéntanos qué pasó"
            htmlFor="pqr-message"
            error={errors.message}
            hint="Entre más detalles, mejor podemos ayudarte."
          >
            <Textarea id="pqr-message" rows={6} {...register("message")} />
          </Field>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Al enviar aceptas que tratemos tus datos para atender tu solicitud,
          conforme a nuestra{" "}
          <Link href="/datos-personales" target="_blank" className="text-primary hover:underline">
            Política de datos personales
          </Link>
          . Recibirás un número de radicado para hacerle seguimiento.
        </p>
      </div>

      <div className="flex justify-end pb-10">
        <Button type="submit" disabled={isSubmitting} className="gap-1.5">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Radicar PQR
        </Button>
      </div>
    </form>
  );
}

/** Formulario de contacto general. */
export function ContactForm({
  defaults,
}: {
  defaults: { name: string; email: string };
}) {
  const [sent, setSent] = React.useState<Sent | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: defaults.name,
      email: defaults.email,
      phone: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await api.post<Sent>("/api/support", {
        ...values,
        kind: "CONTACTO",
      });
      setSent(res);
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No pudimos enviar tu mensaje",
      );
    }
  });

  if (sent) return <Acuse sent={sent} isPqr={false} />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" htmlFor="c-name" error={errors.name}>
              <Input id="c-name" autoComplete="name" {...register("name")} />
            </Field>
            <Field label="Correo" htmlFor="c-email" error={errors.email}>
              <Input
                id="c-email"
                type="email"
                autoComplete="email"
                {...register("email")}
              />
            </Field>
          </div>

          <Field label="Teléfono" htmlFor="c-phone" optional error={errors.phone}>
            <Input
              id="c-phone"
              autoComplete="tel"
              placeholder="+57 301 234 5678"
              {...register("phone")}
            />
          </Field>

          <Field label="Asunto" htmlFor="c-subject" error={errors.subject}>
            <Input
              id="c-subject"
              placeholder="¿Sobre qué nos escribes?"
              {...register("subject")}
            />
          </Field>

          <Field label="Mensaje" htmlFor="c-message" error={errors.message}>
            <Textarea id="c-message" rows={6} {...register("message")} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end pb-10">
        <Button type="submit" disabled={isSubmitting} className="gap-1.5">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Enviar mensaje
        </Button>
      </div>
    </form>
  );
}
