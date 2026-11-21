"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, ArrowLeft, Loader2, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import { AuthCard, AuthHeading, AuthNotice } from "@/components/auth/auth-card";
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
    <AuthCard
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1 rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Volver a iniciar sesión
        </Link>
      }
    >
      {sentTo ? (
        <AuthNotice icon={CheckCircle2} title="Revisa tu correo">
          Si <span className="font-medium text-foreground">{sentTo}</span> tiene
          una cuenta, te enviamos un enlace para restablecer tu contraseña. El
          enlace vence en 1 hora.
        </AuthNotice>
      ) : (
        <>
          <AuthHeading
            title="Recuperar contraseña"
            description="Escribe tu correo y te enviaremos un enlace para elegir una nueva."
          />

          <form className="space-y-4" onSubmit={onSubmit}>
            <Field label="Correo electrónico" htmlFor="fp-email" error={errors.email}>
              <div className="relative">
                <Mail
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
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
    </AuthCard>
  );
}
