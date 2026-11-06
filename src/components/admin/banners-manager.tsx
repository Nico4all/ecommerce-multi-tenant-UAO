"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/admin/page-heading";
import { BannerAdminCard } from "@/components/admin/banner-admin-card";
import {
  BannerFormDialog,
  emptyBannerForm,
  sectionLabel,
  sectionSlot,
  HERO_SLOT,
  HERO_SIDE_SLOT,
  type BannerFormValues,
} from "@/components/admin/banner-form-dialog";
import { BANNER_GRADIENTS } from "@/lib/banner-styles";
import type { AdminBannerRow } from "@/lib/server/admin/banners";
import type { AdminHomeSection } from "@/lib/server/admin/home-sections";
import type { Banner } from "@/types";

function toUiBanner(b: AdminBannerRow): Banner {
  return {
    id: b.id,
    title: b.title ?? undefined,
    subtitle: b.subtitle ?? undefined,
    highlight: b.highlight ?? undefined,
    cta: b.ctaText ?? undefined,
    href: b.href,
    className: b.bgClass ?? BANNER_GRADIENTS[2].value,
    imageUrl: b.imageUrl,
  };
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="font-heading font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export function BannersManager({
  banners,
  sections,
}: {
  banners: AdminBannerRow[];
  sections: AdminHomeSection[];
}) {
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<BannerFormValues>(emptyBannerForm);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyBannerForm);
    setOpen(true);
  };
  const openEdit = (b: AdminBannerRow) => {
    setEditingId(b.id);
    setForm({
      slot: b.sectionId
        ? sectionSlot(b.sectionId)
        : b.placement === "HERO_SIDE"
          ? HERO_SIDE_SLOT
          : HERO_SLOT,
      highlight: b.highlight ?? "",
      ctaText: b.ctaText ?? "",
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      href: b.href,
      bgClass: BANNER_GRADIENTS.some((g) => g.value === b.bgClass)
        ? (b.bgClass as string)
        : BANNER_GRADIENTS[0].value,
      imageUrl: b.imageUrl ?? "",
      active: b.active,
    });
    setOpen(true);
  };

  const heroSlides = banners.filter((b) => b.placement === "HERO" && !b.sectionId);
  const heroSides = banners.filter((b) => b.placement === "HERO_SIDE" && !b.sectionId);
  const hostSections = sections.filter(
    (s) => s.kind === "BANNERS" || s.kind === "PRODUCTS",
  );
  const orphans = banners.filter(
    (b) => !b.sectionId && b.placement !== "HERO" && b.placement !== "HERO_SIDE",
  );

  const cardsGrid = (items: AdminBannerRow[], ratio?: string) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((b) => (
        <div key={b.id} className={cn(!b.active && "opacity-50")}>
          <BannerAdminCard
            banner={toUiBanner(b)}
            ratio={ratio}
            onEdit={() => openEdit(b)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeading
        title="Imágenes del landing"
        description="Banners del inicio, agrupados por la sección donde aparecen"
      >
        <Button className="h-9 gap-2" onClick={openNew}>
          <Plus className="size-4" />
          Nuevo banner
        </Button>
      </PageHeading>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Un banner puede ir en el hero, en una sección de banners, o{" "}
          <span className="font-medium text-foreground">junto a una fila de
          productos</span>. Para cambiar el orden de las secciones ve a{" "}
          <Link href="/admin/home" className="font-medium text-primary hover:underline">
            Página de inicio
          </Link>
          .
        </p>
      </div>

      <Group
        title="Carrusel principal (hero)"
        hint="Se rotan automáticamente en la parte superior del inicio"
      >
        {heroSlides.length > 0 ? (
          cardsGrid(heroSlides)
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Sin banners en el carrusel.
          </p>
        )}
      </Group>

      <Group
        title="Banners laterales del hero"
        hint="Se apilan junto al carrusel; con 2 o más se muestran compactos"
      >
        {heroSides.length > 0 ? (
          cardsGrid(heroSides)
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Sin banners laterales.
          </p>
        )}
      </Group>

      {/* Una agrupación por cada sección que puede alojar banners */}
      {hostSections.map((s, i) => {
        const items = banners.filter((b) => b.sectionId === s.id);
        const isWide = s.kind === "BANNERS" && s.bannerLayout === "WIDE";
        const hint =
          s.kind === "BANNERS"
            ? `Posición ${s.sortOrder + 1} de la home${s.active ? "" : " · sección oculta"}`
            : `Se muestra junto a los productos (${s.bannerPosition === "RIGHT" ? "derecha" : s.bannerPosition === "TOP" ? "arriba" : s.bannerPosition === "BOTTOM" ? "abajo" : "izquierda"})`;
        return (
          <Group key={s.id} title={sectionLabel(s, i)} hint={hint}>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Sin banners aquí. Crea uno y elige esta ubicación.
              </p>
            ) : isWide ? (
              <div className="space-y-4">
                {items.map((b) => (
                  <div key={b.id} className={cn(!b.active && "opacity-50")}>
                    <BannerAdminCard
                      banner={toUiBanner(b)}
                      ratio="aspect-[16/4]"
                      onEdit={() => openEdit(b)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              cardsGrid(items)
            )}
            {s.kind === "PRODUCTS" && items.length > 1 && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Una fila de productos muestra solo el primer banner; los demás se
                ignoran.
              </p>
            )}
          </Group>
        );
      })}

      {orphans.length > 0 && (
        <Group
          title="Sin sección asignada"
          hint="Estos banners no se muestran hasta que los asignes a una sección"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orphans.map((b) => (
              <div key={b.id} className="opacity-60">
                <BannerAdminCard banner={toUiBanner(b)} onEdit={() => openEdit(b)} />
              </div>
            ))}
          </div>
        </Group>
      )}

      <BannerFormDialog
        open={open}
        onOpenChange={setOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        sections={sections}
      />
    </div>
  );
}
