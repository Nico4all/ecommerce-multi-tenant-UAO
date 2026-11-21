import "server-only";
import { prisma } from "@/lib/prisma";
import { adminStoreId, requireSection } from "./scope";
import { assertImageReferences } from "../storage";
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
  const storeId = await adminStoreId();
  return prisma.banner.findMany({
    where: { storeId },
    orderBy: [{ placement: "asc" }, { sortOrder: "asc" }],
  });
}

export async function createBanner(input: BannerInput): Promise<AdminBannerRow> {
  const storeId = await adminStoreId();
  if (input.sectionId) await requireSection(input.sectionId, storeId);
  await assertImageReferences([input.imageUrl]);
  return prisma.banner.create({ data: { ...toData(input), storeId } });
}

export async function updateBanner(
  id: string,
  input: BannerInput,
): Promise<AdminBannerRow> {
  const storeId = await adminStoreId();
  if (!await prisma.banner.findUnique({ where: { id, storeId }, select: { id: true } })) throw new ApiError(404, "Banner no encontrado");
  if (input.sectionId) await requireSection(input.sectionId, storeId);
  await assertImageReferences([input.imageUrl]);
  const updated = await prisma.banner
    .update({ where: { id, storeId }, data: toData(input) })
    .catch(() => null);
  if (!updated) throw new ApiError(404, "Banner no encontrado");
  return updated;
}

export async function deleteBanner(id: string): Promise<void> {
  const storeId = await adminStoreId();
  await prisma.banner.delete({ where: { id, storeId } }).catch(() => {
    throw new ApiError(404, "Banner no encontrado");
  });
}
