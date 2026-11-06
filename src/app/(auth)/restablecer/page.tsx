"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
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
      <Card>
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" />
          </span>
          <h1 className="mt-4 font-heading text-xl font-bold">Enlace incompleto</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Abre el enlace completo que te llegó al correo, o solicita uno nuevo.
          </p>
          <Link href="/forgot" className={cn(buttonVariants(), "mt-5")}>
            Solicitar otro enlace
          </Link>
        </div>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="mt-4 font-heading text-xl font-bold">Contraseña cambiada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
          <Link href="/login" className={cn(buttonVariants(), "mt-5")}>
            Iniciar sesión
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-6 text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Nueva contraseña
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige una contraseña de al menos 8 caracteres.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <Field label="Nueva contraseña" htmlFor="rp-password" error={errors.password}>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="rp-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-11 pl-9"
              {...register("password")}
            />
          </div>
        </Field>

        <Field label="Repite la contraseña" htmlFor="rp-confirm" error={errors.confirm}>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="rp-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-11 pl-9"
              {...register("confirm")}
            />
          </div>
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
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetForm />
    </React.Suspense>
  );
}
