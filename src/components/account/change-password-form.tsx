"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form-field";
import { PasswordField } from "@/components/auth/password-field";
import {
  changePasswordFormSchema,
  type ChangePasswordValues,
} from "@/lib/account-forms";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Cambia la contraseña del usuario logueado.
 * `hasPassword=false` (cuentas viejas creadas con Google, cuando ese login
 * existía) oculta el campo de contraseña actual: se fija una por primera vez.
 */
export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/api/account/password", {
        currentPassword: hasPassword ? values.currentPassword : undefined,
        newPassword: values.newPassword,
      });
      toast.success("Contraseña actualizada");
      reset();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo cambiar la contraseña",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {hasPassword && (
        <Field label="Contraseña actual" htmlFor="cp-current" error={errors.currentPassword}>
          <PasswordField
            id="cp-current"
            withLock={false}
            className="h-9"
            autoComplete="current-password"
            {...register("currentPassword")}
          />
        </Field>
      )}
      <Field label="Nueva contraseña" htmlFor="cp-new" error={errors.newPassword}>
        <PasswordField
          id="cp-new"
          withLock={false}
          className="h-9"
          minLength={8}
          autoComplete="new-password"
          {...register("newPassword")}
        />
      </Field>
      <Field label="Repite la nueva contraseña" htmlFor="cp-confirm" error={errors.confirm}>
        <PasswordField
          id="cp-confirm"
          withLock={false}
          className="h-9"
          autoComplete="new-password"
          {...register("confirm")}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="gap-1.5">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}
