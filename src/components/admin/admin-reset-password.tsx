"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import {
  adminResetPasswordFormSchema,
  type AdminResetPasswordValues,
} from "@/lib/admin-user-form";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Reset de contraseña por el admin: fija una nueva para el usuario y se la pasa.
 * Sirve de respaldo del enlace por correo (p.ej. si la persona no lo recibe).
 */
export function AdminResetPassword({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdminResetPasswordValues>({
    resolver: zodResolver(adminResetPasswordFormSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await api.post(`/api/admin/users/${userId}/password`, { password });
      toast.success(`Contraseña actualizada. Pásasela a ${userName.split(" ")[0]}.`);
      reset();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo cambiar la contraseña",
      );
    }
  });

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
        <KeyRound className="size-4 text-primary" />
        Restablecer contraseña
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Fija una contraseña nueva y entrégasela a la persona. Podrá cambiarla luego
        desde su cuenta.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nueva contraseña" htmlFor="ar-password" error={errors.password}>
          <Input id="ar-password" type="text" autoComplete="off" {...register("password")} />
        </Field>
        <Field label="Repite la contraseña" htmlFor="ar-confirm" error={errors.confirm}>
          <Input id="ar-confirm" type="text" autoComplete="off" {...register("confirm")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Guardar contraseña
          </Button>
        </div>
      </form>
    </section>
  );
}
