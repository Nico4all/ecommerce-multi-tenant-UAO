import "server-only";
import { prisma } from "@/lib/prisma";
import type { Banner } from "@/types";

export interface HomeBanners {
  hero: Banner[];
  sides: Banner[];
  promos: Banner[];
  strips: Banner[];
}

type DbBanner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  highlight: string | null;
  ctaText: string | null;
  href: string;
  bgClass: string | null;
  imageUrl: string | null;
};

function toBanner(b: DbBanner): Banner {
  return {
    id: b.id,
    title: b.title ?? undefined,
    subtitle: b.subtitle ?? undefined,
    highlight: b.highlight ?? undefined,
    cta: b.ctaText ?? undefined,
    href: b.href,
    className:
      b.bgClass ?? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white",
    imageUrl: b.imageUrl,
  };
}

/**
 * Banners activos del landing, agrupados por ubicación.
 * Sin banners cargados devuelve listas vacías: la home simplemente no los pinta
 * (nunca se inventan banners de ejemplo).
 */
export async function getHomeBanners(): Promise<HomeBanners> {
  const rows = await prisma.banner.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  // TODAS las activas de cada ubicación (añadir otra nunca "reemplaza").
  const by = (p: string) => rows.filter((r) => r.placement === p);
  return {
    hero: by("HERO").map(toBanner),
    sides: by("HERO_SIDE").map(toBanner),
    promos: by("PROMO").map(toBanner),
    strips: by("STRIP").map(toBanner),
  };
}
