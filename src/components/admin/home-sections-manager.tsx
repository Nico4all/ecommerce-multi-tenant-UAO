"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Eye,
  EyeOff,
  GalleryHorizontalEnd,
  LayoutGrid,
  Package,
  Images,
  Info,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeading } from "@/components/admin/page-heading";
import { SOURCE_LABEL, POSITION_LABEL } from "@/lib/home-section-form";
import { api, ApiClientError } from "@/lib/api-client";
import type { AdminHomeSection } from "@/lib/server/admin/home-sections";
import type { HomeSectionKind } from "@/lib/server/home";
import type { Category } from "@/types";

const KIND_META: Record<
  HomeSectionKind,
  { label: string; icon: typeof Package; hint: string }
> = {
  HERO: {
    label: "Carrusel principal",
    icon: GalleryHorizontalEnd,
    hint: "Banners hero + laterales",
  },
  CATEGORIES: {
    label: "Círculos de categorías",
    icon: LayoutGrid,
    hint: "Explora categorías populares",
  },
  PRODUCTS: { label: "Fila de productos", icon: Package, hint: "" },
  BANNERS: { label: "Banners", icon: Images, hint: "" },
};

function describe(s: AdminHomeSection, categories: Category[]): string {
  if (s.kind === "PRODUCTS") {
    const cat = categories.find((c) => c.slug === s.categorySlug);
    const fuente =
      s.source === "CATEGORY"
        ? `de ${cat?.name ?? s.categorySlug}`
        : `· ${SOURCE_LABEL[s.source ?? "OFFERS"]}`;
    const extras = [
      s.bannerPosition ? `banner ${POSITION_LABEL[s.bannerPosition].toLowerCase()}` : null,
      s.bgImageUrl ? "fondo con imagen" : s.bgClass ? "fondo de color" : null,
    ].filter(Boolean);
    return `${s.maxItems} productos ${fuente}${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
  }
  if (s.kind === "BANNERS") {
    const layout = s.bannerLayout === "WIDE" ? "franja ancha" : "rejilla";
    return `${s.bannerCount} banner(s) · ${layout}`;
  }
  return KIND_META[s.kind].hint;
}

export function HomeSectionsManager({
  sections,
  categories,
}: {
  sections: AdminHomeSection[];
  categories: Category[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const move = async (s: AdminHomeSection, direction: "up" | "down") => {
    setBusy(s.id);
    try {
      await api.patch(`/api/admin/home-sections/${s.id}/move`, { direction });
      router.refresh();
    } catch {
      toast.error("No se pudo mover la sección");
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (s: AdminHomeSection) => {
    setBusy(s.id);
    try {
      // El PATCH reemplaza la sección entera: hay que reenviar todos los
      // campos o se perderían (p. ej. el fondo volvería a null).
      await api.patch(`/api/admin/home-sections/${s.id}`, {
        kind: s.kind,
        title: s.title,
        source: s.source,
        categorySlug: s.categorySlug,
        maxItems: s.maxItems,
        href: s.href,
        bannerLayout: s.bannerLayout,
        bannerPosition: s.bannerPosition,
        bgClass: s.bgClass,
        bgImageUrl: s.bgImageUrl,
        bgOverlay: s.bgOverlay,
        active: !s.active,
      });
      toast.success(s.active ? "Sección oculta" : "Sección visible");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo cambiar la visibilidad",
      );
    } finally {
      setBusy(null);
    }
  };

  const remove = async (s: AdminHomeSection) => {
    setBusy(s.id);
    try {
      await api.delete(`/api/admin/home-sections/${s.id}`);
      toast.success("Sección eliminada");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo eliminar la sección",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeading
        title="Página de inicio"
        description="Decide qué secciones salen, en qué orden y con qué contenido"
      >
        <Link href="/admin/home/new" className={cn(buttonVariants(), "h-9 gap-2")}>
          <Plus className="size-4" />
          Nueva sección
        </Link>
      </PageHeading>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          El orden de esta lista es el orden real de la home. Sube o baja una
          sección de banners para colocarla arriba o debajo de cualquier fila de
          productos. Los banners se asignan a su sección desde{" "}
          <Link href="/admin/banners" className="font-medium text-primary hover:underline">
            Imágenes del landing
          </Link>
          .
        </p>
      </div>

      <ol className="space-y-2">
        {sections.map((s, i) => {
          const meta = KIND_META[s.kind];
          return (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-opacity",
                (!s.active || busy === s.id) && "opacity-60",
              )}
            >
              {/* Orden */}
              <div className="flex flex-col">
                <button
                  onClick={() => move(s, "up")}
                  disabled={i === 0 || busy !== null}
                  aria-label="Subir sección"
                  className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  onClick={() => move(s, "down")}
                  disabled={i === sections.length - 1 || busy !== null}
                  aria-label="Bajar sección"
                  className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>

              <span
                className={cn(
                  "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary",
                  s.bgClass,
                )}
              >
                {s.bgImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL externa definida por el admin */}
                    <img
                      src={s.bgImageUrl}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 size-full object-cover"
                    />
                    <ImageIcon className="relative size-4 text-white drop-shadow" />
                  </>
                ) : (
                  <meta.icon className={cn("size-4", s.bgClass && "text-white")} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {s.kind === "PRODUCTS" ? s.title : meta.label}
                  {!s.active && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Oculta
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.kind === "PRODUCTS" ? "Fila de productos · " : ""}
                  {describe(s, categories)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {busy === s.id && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                <button
                  onClick={() => toggleActive(s)}
                  disabled={busy !== null}
                  aria-label={s.active ? "Ocultar" : "Mostrar"}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {s.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
                {(s.kind === "PRODUCTS" || s.kind === "BANNERS") && (
                  <Link
                    href={`/admin/home/${s.id}/edit`}
                    aria-label="Editar"
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </Link>
                )}
                <button
                  onClick={() => remove(s)}
                  disabled={busy !== null}
                  aria-label="Eliminar"
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
        {sections.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No hay secciones. La home mostrará una composición por defecto hasta
            que crees la primera.
          </li>
        )}
      </ol>
    </div>
  );
}
