"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/form-field";
import {
  AuthCard,
  AuthError,
  AuthHeading,
  AuthNotice,
} from "@/components/auth/auth-card";
import { PasswordField } from "@/components/auth/password-field";
import {
  resetPasswordFormSchema,
  type ResetPasswordValues,
} from "@/lib/account-forms";
import { api, ApiClientError } from "@/lib/api-client";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await api.post("/api/auth/password/reset", { token, password });
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : "No se pudo restablecer la contraseña",
      );
    }
  });

  if (!token) {
    return (
      <AuthCard>
        <AuthNotice
          icon={AlertCircle}
          tone="error"
          title="Enlace incompleto"
          action={
            <Link href="/forgot" className={cn(buttonVariants(), "h-10")}>
              Solicitar otro enlace
            </Link>
          }
        >
          Abre el enlace completo que te llegó al correo, o solicita uno nuevo.
        </AuthNotice>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard>
        <AuthNotice
          icon={CheckCircle2}
          title="Contraseña cambiada"
          action={
            <Link href="/login" className={cn(buttonVariants(), "h-10")}>
              Iniciar sesión
            </Link>
          }
        >
          Ya puedes iniciar sesión con tu nueva contraseña.
        </AuthNotice>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthHeading
        title="Nueva contraseña"
        description="Elige una contraseña de al menos 8 caracteres."
      />

      <form className="space-y-4" onSubmit={onSubmit}>
        {error && <AuthError>{error}</AuthError>}

        <Field label="Nueva contraseña" htmlFor="rp-password" error={errors.password}>
          <PasswordField
            id="rp-password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("password")}
          />
        </Field>

        <Field label="Repite la contraseña" htmlFor="rp-confirm" error={errors.confirm}>
          <PasswordField
            id="rp-confirm"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("confirm")}
          />
        </Field>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full gap-2 text-base"
        >
          {isSubmitting && <Loader2 className="size-5 animate-spin" />}
          Guardar contraseña
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetForm />
    </React.Suspense>
  );
}
