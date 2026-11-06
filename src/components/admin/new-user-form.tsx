"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import { FormSelect } from "@/components/admin/form-select";
import { newUserFormSchema, type NewUserValues } from "@/lib/admin-user-form";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Alta de usuario desde el panel. Un ADMIN se crea con correo y contraseña que
 * luego el admin le pasa a la persona; un CLIENTE puede quedar sin contraseña
 * (la fija al registrarse).
 */
export function NewUserForm() {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewUserValues>({
    resolver: zodResolver(newUserFormSchema),
    defaultValues: { name: "", email: "", phone: "", role: "CUSTOMER", password: "" },
  });

  const role = watch("role");
  const isAdmin = role === "ADMIN";

  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.post("/api/admin/users", {
        name: v.name,
        email: v.email,
        phone: v.phone || undefined,
        role: v.role,
        password: v.password || undefined,
      });
      toast.success(
        isAdmin
          ? `Administrador creado. Pásale el correo y la contraseña a ${v.name.split(" ")[0]}.`
          : "Usuario creado",
      );
      router.push("/admin/users");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo crear el usuario",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <Field label="Nombre completo" htmlFor="nu-name" error={errors.name}>
          <Input id="nu-name" autoComplete="off" {...register("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Correo electrónico" htmlFor="nu-email" error={errors.email}>
            <Input id="nu-email" type="email" autoComplete="off" {...register("email")} />
          </Field>
          <Field label="Teléfono" htmlFor="nu-phone" optional error={errors.phone}>
            <Input id="nu-phone" type="tel" placeholder="+57 301 234 5678" {...register("phone")} />
          </Field>
        </div>

        <Field label="Rol" htmlFor="nu-role" error={errors.role}>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <FormSelect
                id="nu-role"
                className="w-48"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "CUSTOMER", label: "Cliente" },
                  { value: "ADMIN", label: "Administrador" },
                ]}
              />
            )}
          />
        </Field>

        <Field
          label={isAdmin ? "Contraseña" : "Contraseña"}
          htmlFor="nu-password"
          optional={!isAdmin}
          error={errors.password}
          hint={
            isAdmin
              ? "Se la entregas a la persona para que entre al panel. Mínimo 8 caracteres."
              : "Opcional. Si la dejas vacía, el cliente la define al registrarse."
          }
        >
          <Input
            id="nu-password"
            type="text"
            autoComplete="off"
            placeholder={isAdmin ? "Contraseña para entregar" : "—"}
            {...register("password")}
          />
        </Field>

        {isAdmin && (
          <p className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-xs text-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Este usuario tendrá acceso completo al panel de administración. Comparte
            las credenciales por un canal seguro; la persona puede cambiar su
            contraseña luego desde su perfil.
          </p>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/users")}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="gap-1.5">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Crear usuario
        </Button>
      </div>
    </form>
  );
}
