"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/admin/page-heading";
import { FormSelect } from "@/components/admin/form-select";
import { ImageUploader } from "@/components/admin/image-uploader";
import { SECTION_BACKGROUNDS } from "@/lib/banner-styles";
import {
  homeSectionFormSchema,
  emptyHomeSection,
  toHomeSectionPayload,
  KIND_LABEL,
  SOURCE_LABEL,
  POSITION_LABEL,
  type HomeSectionFormValues,
} from "@/lib/home-section-form";
import { api, ApiClientError } from "@/lib/api-client";
import type { AdminHomeSection } from "@/lib/server/admin/home-sections";
import type { HomeSectionKind, ProductSource } from "@/lib/server/home";
import type { Category } from "@/types";

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Fieldset({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-medium">{title}</h2>
      {description && (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Vista previa del fondo de la fila, con productos de mentira. */
function BackgroundPreview({
  title,
  bgClass,
  bgImageUrl,
  bgOverlay,
}: {
  title: string;
  bgClass: string;
  bgImageUrl: string;
  bgOverlay: number;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-4",
        !bgClass && !bgImageUrl && "border border-dashed border-border",
        bgClass,
      )}
    >
      {bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- URL externa definida por el admin
        <img
          src={bgImageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {bgImageUrl && bgOverlay > 0 && (
        <span
          aria-hidden
          className="absolute inset-0 bg-black"
          style={{ opacity: bgOverlay / 100 }}
        />
      )}
      <div className="relative">
        <p
          className={cn(
            "text-sm font-bold",
            bgClass || bgImageUrl ? "text-white drop-shadow-sm" : "text-foreground",
          )}
        >
          {title || "Título de la fila"}
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-white/90 shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Alta y edición de secciones de la home. Página dedicada (no modal): el
 * formulario crece con el fondo de campaña y su vista previa.
 */
export function HomeSectionForm({
  section,
  categories,
}: {
  section?: AdminHomeSection;
  categories: Category[];
}) {
  const router = useRouter();
  const isEdit = !!section;

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<HomeSectionFormValues>({
    resolver: zodResolver(homeSectionFormSchema),
    defaultValues: section
      ? {
          kind: section.kind,
          title: section.title ?? "",
          source: section.source ?? "OFFERS",
          categorySlug: section.categorySlug ?? "",
          maxItems: section.maxItems,
          href: section.href ?? "",
          bannerLayout: section.bannerLayout ?? "GRID",
          bannerPosition: section.bannerPosition ?? "NONE",
          bgClass: section.bgClass ?? "",
          bgImageUrl: section.bgImageUrl ?? "",
          bgOverlay: section.bgOverlay,
          active: section.active,
        }
      : emptyHomeSection,
  });

  const kind = watch("kind");
  const source = watch("source");
  const bannerPosition = watch("bannerPosition");
  const bgClass = watch("bgClass");
  const bgImageUrl = watch("bgImageUrl");
  const bgOverlay = watch("bgOverlay");
  const title = watch("title");

  const onSubmit = handleSubmit(async (values) => {
    const payload = toHomeSectionPayload(values);
    try {
      if (isEdit) {
        await api.patch(`/api/admin/home-sections/${section.id}`, payload);
        toast.success("Sección actualizada");
      } else {
        await api.post("/api/admin/home-sections", payload);
        toast.success("Sección creada");
      }
      router.push("/admin/home");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo guardar la sección",
      );
    }
  });

  const bannersLink = (
    <Link href="/admin/banners" className="text-primary hover:underline">
      Imágenes del landing
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/home"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a Página de inicio
      </Link>

      <PageHeading
        title={isEdit ? "Editar sección" : "Nueva sección"}
        description="Configura qué muestra esta sección de la página de inicio."
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <Fieldset title="Tipo">
          <Field
            label="Tipo de sección"
            htmlFor="hs-kind"
            hint={
              isEdit
                ? "El tipo no se puede cambiar; crea otra sección si lo necesitas."
                : undefined
            }
          >
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <FormSelect
                  id="hs-kind"
                  value={field.value}
                  onChange={(v) => field.onChange(v as HomeSectionKind)}
                  disabled={isEdit}
                  options={(Object.keys(KIND_LABEL) as HomeSectionKind[]).map((k) => ({
                    value: k,
                    label: KIND_LABEL[k],
                  }))}
                />
              )}
            />
          </Field>

          <Field label="Visibilidad" htmlFor="hs-active">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <FormSelect
                  id="hs-active"
                  value={field.value ? "yes" : "no"}
                  onChange={(v) => field.onChange(v === "yes")}
                  options={[
                    { value: "yes", label: "Visible" },
                    { value: "no", label: "Oculta" },
                  ]}
                />
              )}
            />
          </Field>
        </Fieldset>

        {kind === "PRODUCTS" && (
          <>
            <Fieldset title="Contenido" description="Qué productos salen en la fila.">
              <Field label="Título" htmlFor="hs-title" error={errors.title?.message}>
                <Input
                  id="hs-title"
                  placeholder="Mejores ofertas de hoy"
                  {...register("title")}
                />
              </Field>

              <Field label="¿Qué productos?" htmlFor="hs-source">
                <Controller
                  control={control}
                  name="source"
                  render={({ field }) => (
                    <FormSelect
                      id="hs-source"
                      value={field.value}
                      onChange={(v) => field.onChange(v as ProductSource)}
                      options={(Object.keys(SOURCE_LABEL) as ProductSource[]).map(
                        (s) => ({ value: s, label: SOURCE_LABEL[s] }),
                      )}
                    />
                  )}
                />
              </Field>

              {source === "CATEGORY" && (
                <Field
                  label="Categoría"
                  htmlFor="hs-cat"
                  error={errors.categorySlug?.message}
                >
                  <Controller
                    control={control}
                    name="categorySlug"
                    render={({ field }) => (
                      <FormSelect
                        id="hs-cat"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Elige una categoría"
                        options={categories.map((c) => ({
                          value: c.slug,
                          label: c.name,
                        }))}
                      />
                    )}
                  />
                </Field>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Cuántos productos"
                  htmlFor="hs-max"
                  error={errors.maxItems?.message}
                >
                  <Input
                    id="hs-max"
                    type="number"
                    min={1}
                    max={20}
                    {...register("maxItems", { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Enlace “Ver todo”" htmlFor="hs-href">
                  <Input id="hs-href" placeholder="Automático" {...register("href")} />
                </Field>
              </div>
            </Fieldset>

            <Fieldset
              title="Banner destacado"
              description="Opcional. La fila funciona perfectamente sin banner."
            >
              <Field
                label="¿Dónde va el banner?"
                htmlFor="hs-bpos"
                hint={
                  bannerPosition === "NONE" ? (
                    <>Esta fila mostrará solo productos, sin banner.</>
                  ) : (
                    <>
                      Asigna el banner a esta fila desde {bannersLink}. Si no hay
                      ninguno asignado, la fila se muestra normal.
                    </>
                  )
                }
              >
                <Controller
                  control={control}
                  name="bannerPosition"
                  render={({ field }) => (
                    <FormSelect
                      id="hs-bpos"
                      value={field.value}
                      onChange={field.onChange}
                      options={(
                        Object.keys(POSITION_LABEL) as (keyof typeof POSITION_LABEL)[]
                      ).map((p) => ({ value: p, label: POSITION_LABEL[p] }))}
                    />
                  )}
                />
              </Field>
            </Fieldset>

            <Fieldset
              title="Fondo de la sección"
              description="Da a toda la fila un aire de campaña, como las tiendas grandes."
            >
              <Field
                label="Imagen de fondo"
                error={errors.bgImageUrl?.message}
                hint="La gráfica de la campaña. Déjalo vacío para usar solo color."
              >
                <Controller
                  control={control}
                  name="bgImageUrl"
                  render={({ field }) => (
                    <ImageUploader
                      value={field.value}
                      onChange={field.onChange}
                      target="sectionBg"
                    />
                  )}
                />
              </Field>

              <Field
                label="Color de respaldo"
                htmlFor="hs-bg"
                hint="Se ve mientras la imagen carga, si la URL falla, o como fondo único si no pones imagen."
              >
                <Controller
                  control={control}
                  name="bgClass"
                  render={({ field }) => (
                    <FormSelect
                      id="hs-bg"
                      value={field.value || "none"}
                      onChange={(v) => field.onChange(v === "none" ? "" : v)}
                      options={SECTION_BACKGROUNDS.map((b) => ({
                        value: b.value || "none",
                        label: b.label,
                        adornment: b.value ? (
                          <span className={cn("size-3 shrink-0 rounded-full", b.value)} />
                        ) : undefined,
                      }))}
                    />
                  )}
                />
              </Field>

              {bgImageUrl && (
                <Field
                  label={`Oscurecer la imagen · ${bgOverlay}%`}
                  htmlFor="hs-overlay"
                  hint="Sube el velo si el título o el enlace “Ver todo” no se leen bien sobre la imagen."
                >
                  <input
                    id="hs-overlay"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    className="w-full accent-primary"
                    {...register("bgOverlay", { valueAsNumber: true })}
                  />
                </Field>
              )}

              <div className="space-y-1.5">
                <Label>Vista previa</Label>
                <BackgroundPreview
                  title={title}
                  bgClass={bgClass}
                  bgImageUrl={bgImageUrl}
                  bgOverlay={bgOverlay}
                />
              </div>
            </Fieldset>
          </>
        )}

        {kind === "BANNERS" && (
          <Fieldset title="Formato">
            <Field
              label="Disposición"
              htmlFor="hs-layout"
              hint={<>Después asigna banners a esta sección desde {bannersLink}.</>}
            >
              <Controller
                control={control}
                name="bannerLayout"
                render={({ field }) => (
                  <FormSelect
                    id="hs-layout"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "GRID", label: "Rejilla (hasta 3 por fila)" },
                      { value: "WIDE", label: "Franja ancha" },
                    ]}
                  />
                )}
              />
            </Field>
          </Fieldset>
        )}

        <div className="flex items-center justify-end gap-2 pb-10">
          <Link
            href="/admin/home"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear sección"}
          </Button>
        </div>
      </form>
    </div>
  );
}
