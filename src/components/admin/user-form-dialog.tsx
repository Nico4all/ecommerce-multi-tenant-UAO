"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/admin/form-select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api, ApiClientError } from "@/lib/api-client";
import type { AdminUserDetail } from "@/lib/server/admin/users";

export function UserFormDialog({
  mode,
  user,
}: {
  mode: "invite" | "edit";
  user?: AdminUserDetail;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone && user.phone !== "—" ? user.phone : "",
    status: user?.status ?? ("ACTIVE" as "ACTIVE" | "INACTIVE"),
    street: user?.address?.street ?? "",
    city: user?.address?.city ?? "",
    state: user?.address?.state ?? "",
    zip: user?.address?.zip ?? "",
    country: user?.address?.country ?? "Colombia",
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true);
    const hasAddress = form.street && form.city && form.state && form.zip;
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      status: form.status,
      address: hasAddress
        ? {
            street: form.street,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country,
          }
        : undefined,
    };
    try {
      if (isEdit && user) {
        await api.patch(`/api/admin/users/${user.id}`, payload);
        toast.success("Usuario actualizado");
      } else {
        await api.post("/api/admin/users", payload);
        toast.success(`Invitación registrada para ${form.email}`);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo guardar el usuario",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          isEdit
            ? buttonVariants({ variant: "outline", size: "default" })
            : buttonVariants({ size: "default" }),
          "h-9 gap-2",
        )}
      >
        {isEdit ? (
          <>
            <Pencil className="size-4" />
            Editar
          </>
        ) : (
          <>
            <UserPlus className="size-4" />
            Invitar usuario
          </>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuario" : "Invitar usuario"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos de contacto y la dirección de envío."
              : "Registra al cliente con sus datos; definirá su contraseña al completar su registro."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto py-2 pr-1">
          {/* Datos de contacto */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos de contacto
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Nombre completo</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="María González"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-email">Correo electrónico</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  placeholder="tu@correo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-phone">Teléfono</Label>
                <Input
                  id="u-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  placeholder="+57 301 234 5678"
                />
              </div>
            </div>
            {isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="u-status">Estado</Label>
                <FormSelect
                  id="u-status"
                  className="w-40"
                  value={form.status}
                  onChange={(v) => set({ status: v as "ACTIVE" | "INACTIVE" })}
                  options={[
                    { value: "ACTIVE", label: "Activo" },
                    { value: "INACTIVE", label: "Inactivo" },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Dirección de envío */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dirección de envío
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="u-street">Calle y número</Label>
              <Input
                id="u-street"
                value={form.street}
                onChange={(e) => set({ street: e.target.value })}
                placeholder="Carrera 15 #93-47, Apto 402"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-city">Ciudad</Label>
                <Input
                  id="u-city"
                  value={form.city}
                  onChange={(e) => set({ city: e.target.value })}
                  placeholder="Bogotá"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-state">Departamento</Label>
                <Input
                  id="u-state"
                  value={form.state}
                  onChange={(e) => set({ state: e.target.value })}
                  placeholder="Bogotá D.C."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-zip">Código postal</Label>
                <Input
                  id="u-zip"
                  value={form.zip}
                  onChange={(e) => set({ zip: e.target.value })}
                  placeholder="06600"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-country">País</Label>
                <FormSelect
                  id="u-country"
                  value={form.country}
                  onChange={(v) => set({ country: v })}
                  options={[
                    { value: "Colombia", label: "Colombia" },
                    { value: "Ecuador", label: "Ecuador" },
                    { value: "Perú", label: "Perú" },
                    { value: "Panamá", label: "Panamá" },
                    { value: "México", label: "México" },
                    { value: "Chile", label: "Chile" },
                    { value: "Argentina", label: "Argentina" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose className={cn(buttonVariants({ variant: "outline" }))}>
            Cancelar
          </DialogClose>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Enviar invitación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
