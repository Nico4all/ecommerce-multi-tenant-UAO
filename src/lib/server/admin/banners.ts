import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../auth";
import { ApiError } from "../api-helpers";

export type BannerPlacement = "HERO" | "HERO_SIDE" | "PROMO" | "STRIP";

export interface AdminBannerRow {
  id: string;
  placement: BannerPlacement;
  sectionId: string | null;
  title: string | null;
  subtitle: string | null;
  highlight: string | null;
  ctaText: string | null;
  href: string;
  imageUrl: string | null;
  bgClass: string | null;
  sortOrder: number;
  active: boolean;
}

export interface BannerInput {
  placement: BannerPlacement;
  /** Sección de banners de la home (null = vive en el hero). */
  sectionId?: string | null;
  /** Todo el texto es opcional: un banner puede ser solo la imagen. */
  title?: string | null;
  subtitle?: string | null;
  highlight?: string | null;
  ctaText?: string | null;
  href: string;
  imageUrl?: string | null;
  bgClass?: string | null;
  sortOrder?: number;
  active?: boolean;
}

function toData(input: BannerInput) {
  return {
    placement: input.placement,
    sectionId: input.sectionId || null,
    title: input.title || null,
    subtitle: input.subtitle || null,
    highlight: input.highlight || null,
    ctaText: input.ctaText || null,
    href: input.href,
    imageUrl: input.imageUrl || null,
    bgClass: input.bgClass || null,
    sortOrder: input.sortOrder ?? 0,
    active: input.active ?? true,
  };
}

export async function listAdminBanners(): Promise<AdminBannerRow[]> {
  await requireAdmin();
  return prisma.banner.findMany({
    orderBy: [{ placement: "asc" }, { sortOrder: "asc" }],
  });
}

export async function createBanner(input: BannerInput): Promise<AdminBannerRow> {
  await requireAdmin();
  return prisma.banner.create({ data: toData(input) });
}

export async function updateBanner(
  id: string,
  input: BannerInput,
): Promise<AdminBannerRow> {
  await requireAdmin();
  const updated = await prisma.banner
    .update({ where: { id }, data: toData(input) })
    .catch(() => null);
  if (!updated) throw new ApiError(404, "Banner no encontrado");
  return updated;
}

export async function deleteBanner(id: string): Promise<void> {
  await requireAdmin();
  await prisma.banner.delete({ where: { id } }).catch(() => {
    throw new ApiError(404, "Banner no encontrado");
  });
}
