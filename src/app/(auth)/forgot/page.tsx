"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, ArrowLeft, Loader2, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import { forgotFormSchema, type ForgotValues } from "@/lib/account-forms";
import { api } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotFormSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    // La API responde 200 exista o no la cuenta (no revela correos). Mostramos
    // el mismo mensaje pase lo que pase.
    await api.post("/api/auth/password/forgot", { email }).catch(() => {});
    setSentTo(email);
  });

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {sentTo ? (
          <div className="text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-6" />
            </span>
            <h1 className="mt-4 font-heading text-xl font-bold">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Si <span className="font-medium text-foreground">{sentTo}</span> tiene
              una cuenta, te enviamos un enlace para restablecer tu contraseña. El
              enlace vence en 1 hora.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                Recuperar contraseña
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Escribe tu correo y te enviaremos un enlace para elegir una nueva.
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <Field label="Correo electrónico" htmlFor="fp-email" error={errors.email}>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fp-email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    className="h-11 pl-9"
                    {...register("email")}
                  />
                </div>
              </Field>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full gap-2 text-base"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-5 animate-spin" /> Enviando…
                  </>
                ) : (
                  <>
                    Enviar enlace
                    <Send className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
