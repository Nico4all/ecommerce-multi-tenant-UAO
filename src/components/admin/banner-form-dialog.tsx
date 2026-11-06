"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSelect, type SelectOption } from "@/components/admin/form-select";
import { ImageUploader } from "@/components/admin/image-uploader";
import type { ImageTarget } from "@/lib/image-limits";
import { api, ApiClientError } from "@/lib/api-client";
import { BANNER_GRADIENTS } from "@/lib/banner-styles";
import type { AdminHomeSection } from "@/lib/server/admin/home-sections";

/**
 * Un "slot" describe dónde vive el banner con un solo valor legible:
 * el hero (por placement) o una sección concreta (por sectionId).
 */
export const HERO_SLOT = "hero";
export const HERO_SIDE_SLOT = "hero-side";
export const sectionSlot = (id: string) => `section:${id}`;

export interface BannerFormValues {
  slot: string;
  highlight: string;
  ctaText: string;
  title: string;
  subtitle: string;
  href: string;
  bgClass: string;
  imageUrl: string;
  active: boolean;
}

export const emptyBannerForm: BannerFormValues = {
  slot: HERO_SLOT,
  highlight: "",
  ctaText: "Comprar ahora",
  title: "",
  subtitle: "",
  href: "/",
  bgClass: BANNER_GRADIENTS[0].value,
  imageUrl: "",
  active: true,
};

/** Etiqueta legible de cada sección para el selector de ubicación. */
export function sectionLabel(s: AdminHomeSection, index: number): string {
  const pos = `pos. ${s.sortOrder + 1}`;
  if (s.kind === "BANNERS") {
    const layout = s.bannerLayout === "WIDE" ? "franja ancha" : "rejilla";
    return `Banners #${index + 1} · ${layout} (${pos})`;
  }
  return `Junto a "${s.title ?? "productos"}" (${pos})`;
}

export function BannerFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  setForm,
  sections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: BannerFormValues;
  setForm: React.Dispatch<React.SetStateAction<BannerFormValues>>;
  sections: AdminHomeSection[];
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const isEdit = editingId !== null;
  const set = (patch: Partial<BannerFormValues>) =>
    setForm((f) => ({ ...f, ...patch }));

  // Secciones que pueden alojar banners: las de tipo BANNERS y las filas de
  // productos (donde el banner va junto a los productos).
  const hostSections = sections.filter(
    (s) => s.kind === "BANNERS" || s.kind === "PRODUCTS",
  );

  const slotOptions: SelectOption[] = [
    { value: HERO_SLOT, label: "Carrusel principal (hero)" },
    { value: HERO_SIDE_SLOT, label: "Lateral del hero" },
    ...hostSections.map((s, i) => ({
      value: sectionSlot(s.id),
      label: sectionLabel(s, i),
    })),
  ];

  const resolveSlot = (slot: string) => {
    if (slot === HERO_SLOT) return { placement: "HERO" as const, sectionId: null };
    if (slot === HERO_SIDE_SLOT)
      return { placement: "HERO_SIDE" as const, sectionId: null };
    const id = slot.replace("section:", "");
    const section = hostSections.find((s) => s.id === id);
    return {
      placement:
        section?.kind === "BANNERS" && section.bannerLayout === "WIDE"
          ? ("STRIP" as const)
          : ("PROMO" as const),
      sectionId: id,
    };
  };

  /**
   * El hueco elegido decide la proporción de la imagen: el hero es panorámico,
   * un lateral casi cuadrado y una franja muy alargada. Al cambiar de ubicación
   * cambia también el recuadro del recortador.
   */
  const imageTarget: ImageTarget = React.useMemo(() => {
    const { placement } = resolveSlot(form.slot);
    if (placement === "HERO") return "bannerHero";
    if (placement === "HERO_SIDE") return "bannerSide";
    return placement === "STRIP" ? "bannerStrip" : "bannerPromo";
    // resolveSlot depende de hostSections, que no cambia mientras el diálogo vive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.slot, hostSections]);

  /** ¿La vista previa tiene algo escrito? Decide el velo y el hueco de texto. */
  const previewHasText = !!(form.title || form.subtitle || form.highlight);

  const save = async () => {
    setSaving(true);
    const { placement, sectionId } = resolveSlot(form.slot);
    const payload = {
      placement,
      sectionId,
      title: form.title || null,
      subtitle: form.subtitle || null,
      highlight: form.highlight || null,
      ctaText: form.ctaText || null,
      href: form.href,
      imageUrl: form.imageUrl || null,
      bgClass: form.bgClass,
      active: form.active,
    };
    try {
      if (isEdit) {
        await api.patch(`/api/admin/banners/${editingId}`, payload);
        toast.success("Banner actualizado");
      } else {
        await api.post("/api/admin/banners", payload);
        toast.success("Banner creado");
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo guardar el banner",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/banners/${editingId}`);
      toast.success("Banner eliminado");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo eliminar el banner",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `grid-rows-[auto_1fr_auto]`: cabecera y pie fijos, y el centro se queda
          con el alto sobrante. Sin las filas explícitas todas valen `auto`, el
          centro crece con su contenido y su scroll nunca se activa. */}
      <DialogContent className="max-h-[90dvh] grid-rows-[auto_1fr_auto] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar banner" : "Nuevo banner"}</DialogTitle>
          <DialogDescription>
            Configura el contenido, el enlace y dónde aparece en el inicio.
          </DialogDescription>
        </DialogHeader>

        {/* `min-h-0`: un item de grid no baja de su contenido por defecto, y sin
            esto el `overflow-y-auto` es decorativo. */}
        <div className="grid min-h-0 gap-5 overflow-y-auto pr-1 md:grid-cols-2">
          {/* Columna izquierda: vista previa + ubicación */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Vista previa</Label>
              <div
                className={cn(
                  "relative flex h-36 flex-col justify-between overflow-hidden rounded-xl p-4",
                  form.imageUrl ? "bg-slate-900 text-white" : form.bgClass,
                )}
              >
                {form.imageUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- ruta subida o URL externa del admin */}
                    <img
                      src={form.imageUrl}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 size-full object-cover"
                    />
                    {previewHasText && (
                      <span className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                    )}
                  </>
                )}
                {previewHasText && (
                  <div className="relative min-w-0">
                    {form.highlight && (
                      <span className="block truncate font-heading text-xl font-extrabold leading-none">
                        {form.highlight}
                      </span>
                    )}
                    {form.title && (
                      <p className="mt-1 truncate font-heading text-sm font-bold">
                        {form.title}
                      </p>
                    )}
                    {form.subtitle && (
                      <p className="truncate text-xs opacity-90">{form.subtitle}</p>
                    )}
                  </div>
                )}
                {form.ctaText && (
                  <span className="relative mt-auto inline-flex w-fit max-w-full items-center gap-1 truncate rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900">
                    {form.ctaText}
                    <ArrowRight className="size-3 shrink-0" />
                  </span>
                )}
                {!previewHasText && !form.imageUrl && (
                  <span className="relative m-auto text-xs opacity-70">
                    Sube una imagen o escribe un título
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-slot">Ubicación en el inicio</Label>
              <FormSelect
                id="b-slot"
                value={form.slot}
                onChange={(v) => set({ slot: v })}
                options={slotOptions}
              />
              <p className="text-xs text-muted-foreground">
                Reordena las secciones en{" "}
                <Link href="/admin/home" className="text-primary hover:underline">
                  Página de inicio
                </Link>{" "}
                para moverlo arriba o debajo de una fila de productos.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-active">Visibilidad</Label>
              <FormSelect
                id="b-active"
                value={form.active ? "yes" : "no"}
                onChange={(v) => set({ active: v === "yes" })}
                options={[
                  { value: "yes", label: "Visible en la tienda" },
                  { value: "no", label: "Oculto" },
                ]}
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Imagen de fondo</Label>
              <ImageUploader
                value={form.imageUrl}
                onChange={(url) => set({ imageUrl: url })}
                target={imageTarget}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Sin imagen se usa el estilo de fondo de abajo.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-bg">Estilo de fondo</Label>
              <FormSelect
                id="b-bg"
                value={form.bgClass}
                onChange={(v) => set({ bgClass: v })}
                options={BANNER_GRADIENTS.map((g) => ({
                  value: g.value,
                  label: g.label,
                  adornment: (
                    <span className={cn("size-3 shrink-0 rounded-full", g.value)} />
                  ),
                }))}
              />
            </div>
          </div>

          {/* Columna derecha: textos */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Todo el texto es <strong className="text-foreground">opcional</strong>.
              Si tu imagen ya lo trae escrito, déjalo vacío y se mostrará sola: al
              hacer clic en el banner se va igual al enlace.
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-highlight">
                Texto destacado{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="b-highlight"
                value={form.highlight}
                onChange={(e) => set({ highlight: e.target.value })}
                placeholder="50% OFF"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-title">
                Título{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="b-title"
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Rebajas de Temporada"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-subtitle">
                Subtítulo{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="b-subtitle"
                value={form.subtitle}
                onChange={(e) => set({ subtitle: e.target.value })}
                placeholder="En calzado y ropa seleccionada"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-cta">
                Texto del botón{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="b-cta"
                value={form.ctaText}
                onChange={(e) => set({ ctaText: e.target.value })}
                placeholder="Comprar ahora"
              />
              <p className="text-xs text-muted-foreground">
                Vacío = sin botón. El banner entero sigue llevando al enlace.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-href">Enlace al pulsar</Label>
              <Input
                id="b-href"
                value={form.href}
                onChange={(e) => set({ href: e.target.value })}
                placeholder="/category/deportes"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {isEdit ? (
            <Button
              variant="destructive"
              onClick={remove}
              disabled={deleting || saving}
              className="gap-1.5"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose className={cn(buttonVariants({ variant: "outline" }))}>
              Cancelar
            </DialogClose>
            <Button onClick={save} disabled={saving || deleting} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear banner"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
