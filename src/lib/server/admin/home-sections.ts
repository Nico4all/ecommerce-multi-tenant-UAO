import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { adminStoreId, requireCategory, requireSection } from "./scope";
import { assertImageReferences } from "../storage";
import { ApiError } from "../api-helpers";
import type {
  HomeSectionKind,
  ProductSource,
  BannerLayout,
  SectionBannerPosition,
} from "../home";

export interface AdminHomeSection {
  id: string;
  kind: HomeSectionKind;
  title: string | null;
  source: ProductSource | null;
  categorySlug: string | null;
  maxItems: number;
  href: string | null;
  bannerLayout: BannerLayout | null;
  /** `null` = la fila no muestra banner destacado. */
  bannerPosition: SectionBannerPosition | null;
  bgClass: string | null;
  bgImageUrl: string | null;
  bgOverlay: number;
  sortOrder: number;
  active: boolean;
  /** Banners asignados (contenido en BANNERS, destacado en PRODUCTS). */
  bannerCount: number;
}

export interface HomeSectionInput {
  kind: HomeSectionKind;
  title?: string | null;
  source?: ProductSource | null;
  categorySlug?: string | null;
  maxItems?: number;
  href?: string | null;
  bannerLayout?: BannerLayout | null;
  bannerPosition?: SectionBannerPosition | null;
  bgClass?: string | null;
  bgImageUrl?: string | null;
  bgOverlay?: number | null;
  active?: boolean;
}

function toData(input: HomeSectionInput) {
  const isProducts = input.kind === "PRODUCTS";
  const isBanners = input.kind === "BANNERS";
  return {
    kind: input.kind,
    title: isProducts ? (input.title || null) : null,
    source: isProducts ? (input.source ?? "OFFERS") : null,
    categorySlug:
      isProducts && input.source === "CATEGORY" ? (input.categorySlug || null) : null,
    maxItems: isProducts ? (input.maxItems ?? 5) : 5,
    href: isProducts ? (input.href || null) : null,
    bannerLayout: isBanners ? (input.bannerLayout ?? "GRID") : null,
    // Sin posición no hay banner destacado: es opcional, no se fuerza a LEFT.
    bannerPosition: isProducts ? (input.bannerPosition ?? null) : null,
    bgClass: isProducts ? (input.bgClass || null) : null,
    bgImageUrl: isProducts ? (input.bgImageUrl || null) : null,
    bgOverlay: isProducts ? (input.bgOverlay ?? 0) : 0,
    active: input.active ?? true,
  };
}

type SectionRow = {
  id: string;
  kind: string;
  title: string | null;
  source: string | null;
  categorySlug: string | null;
  maxItems: number;
  href: string | null;
  bannerLayout: string | null;
  bannerPosition: string | null;
  bgClass: string | null;
  bgImageUrl: string | null;
  bgOverlay: number;
  sortOrder: number;
  active: boolean;
  _count: { banners: number };
};

function toAdminSection(s: SectionRow, origin: string): AdminHomeSection {
  return {
    id: s.id,
    kind: s.kind as HomeSectionKind,
    title: s.title,
    source: s.source as ProductSource | null,
    categorySlug: s.categorySlug,
    maxItems: s.maxItems,
    href: s.href,
    bannerLayout: s.bannerLayout as BannerLayout | null,
    bannerPosition: s.bannerPosition as SectionBannerPosition | null,
    bgClass: s.bgClass,
    bgImageUrl: s.bgImageUrl?.startsWith("/") ? new URL(s.bgImageUrl, origin).href : s.bgImageUrl,
    bgOverlay: s.bgOverlay,
    sortOrder: s.sortOrder,
    active: s.active,
    bannerCount: s._count.banners,
  };
}

export async function listHomeSections(): Promise<AdminHomeSection[]> {
  const storeId = await adminStoreId();
  const rows = await prisma.homeSection.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { banners: { where: { storeId } } } } },
  });
  const { origin } = await getStoreContext();
  return rows.map((row) => toAdminSection(row, origin));
}

/** Una sección concreta, para la página de edición. */
export async function getHomeSection(id: string): Promise<AdminHomeSection | null> {
  const storeId = await adminStoreId();
  const row = await prisma.homeSection.findUnique({
    where: { id, storeId },
    include: { _count: { select: { banners: true } } },
  });
  return row ? toAdminSection(row, (await getStoreContext()).origin) : null;
}

export async function createHomeSection(input: HomeSectionInput) {
  const storeId = await adminStoreId();
  const data = toData(input);
  if (data.categorySlug) await requireCategory(data.categorySlug, storeId);
  await assertImageReferences([data.bgImageUrl]);
  const last = await prisma.homeSection.findFirst({
    where: { storeId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return prisma.homeSection.create({
    data: { ...data, storeId, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
}

export async function updateHomeSection(id: string, input: HomeSectionInput) {
  const storeId = await adminStoreId();
  await requireSection(id, storeId);
  const data = toData(input);
  if (data.categorySlug) await requireCategory(data.categorySlug, storeId);
  await assertImageReferences([data.bgImageUrl]);
  const updated = await prisma.homeSection
    .update({ where: { id, storeId }, data })
    .catch(() => null);
  if (!updated) throw new ApiError(404, "Sección no encontrada");
  return updated;
}

export async function deleteHomeSection(id: string): Promise<void> {
  const storeId = await adminStoreId();
  const section = await prisma.homeSection.findUnique({
    where: { id, storeId },
    include: { _count: { select: { banners: true } } },
  });
  if (!section) throw new ApiError(404, "Sección no encontrada");
  if (section._count.banners > 0) {
    throw new ApiError(
      409,
      `Esta sección tiene ${section._count.banners} banner(s). Muévelos o elimínalos primero.`,
    );
  }
  await prisma.homeSection.delete({ where: { id, storeId } });
}

/** Mueve una sección una posición arriba/abajo intercambiando sortOrder. */
export async function moveHomeSection(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const storeId = await adminStoreId();
  const all = await prisma.homeSection.findMany({ where: { storeId }, orderBy: { sortOrder: "asc" } });
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) throw new ApiError(404, "Sección no encontrada");

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= all.length) return; // ya está en el extremo

  const a = all[index];
  const b = all[target];
  await prisma.$transaction([
    prisma.homeSection.update({
      where: { id: a.id, storeId },
      data: { sortOrder: b.sortOrder },
    }),
    prisma.homeSection.update({
      where: { id: b.id, storeId },
      data: { sortOrder: a.sortOrder },
    }),
  ]);
}
