"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import { FormSelect } from "@/components/admin/form-select";
import { profileFormSchema, type ProfileValues } from "@/lib/account-forms";
import { api, ApiClientError } from "@/lib/api-client";
import type { ProfileData } from "@/lib/server/account";

const COUNTRIES = ["Colombia", "Ecuador", "Perú", "Panamá", "México", "Chile", "Argentina"];

/** Edita nombre, teléfono y dirección de envío del propio cliente. */
export function ProfileForm({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: profile.name,
      phone: profile.phone ?? "",
      street: profile.address?.street ?? "",
      city: profile.address?.city ?? "",
      state: profile.address?.state ?? "",
      zip: profile.address?.zip ?? "",
      country: profile.address?.country ?? "Colombia",
    },
  });

  const country = watch("country");

  const onSubmit = handleSubmit(async (v) => {
    const parts = {
      street: v.street?.trim() ?? "",
      city: v.city?.trim() ?? "",
      state: v.state?.trim() ?? "",
      zip: v.zip?.trim() ?? "",
    };
    const filled = Object.values(parts).filter(Boolean).length;
    if (filled > 0 && filled < 4) {
      toast.error("Completa toda la dirección o déjala en blanco");
      return;
    }
    const address =
      filled === 4 ? { ...parts, country: v.country?.trim() || "Colombia" } : null;

    try {
      await api.patch("/api/account", {
        name: v.name,
        phone: v.phone || undefined,
        address,
      });
      toast.success("Perfil actualizado");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo guardar el perfil",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-4">
        <Field label="Nombre completo" htmlFor="pf-name" error={errors.name}>
          <Input id="pf-name" autoComplete="name" {...register("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Correo electrónico" htmlFor="pf-email">
            <Input id="pf-email" value={profile.email} disabled readOnly />
          </Field>
          <Field label="Teléfono" htmlFor="pf-phone" optional error={errors.phone}>
            <Input
              id="pf-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+57 301 234 5678"
              {...register("phone")}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dirección de envío
        </h3>
        <Field label="Calle y número" htmlFor="pf-street" optional error={errors.street}>
          <Input
            id="pf-street"
            placeholder="Carrera 15 #93-47, Apto 402"
            {...register("street")}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ciudad" htmlFor="pf-city" optional error={errors.city}>
            <Input id="pf-city" placeholder="Bogotá" {...register("city")} />
          </Field>
          <Field label="Departamento" htmlFor="pf-state" optional error={errors.state}>
            <Input id="pf-state" placeholder="Bogotá D.C." {...register("state")} />
          </Field>
          <Field label="Código postal" htmlFor="pf-zip" optional error={errors.zip}>
            <Input id="pf-zip" placeholder="110111" {...register("zip")} />
          </Field>
          <Field label="País" htmlFor="pf-country" optional>
            <FormSelect
              id="pf-country"
              value={country ?? "Colombia"}
              onChange={(val) => setValue("country", val)}
              options={COUNTRIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="gap-1.5">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
