import "server-only";
import { prisma } from "@/lib/prisma";
import { adminStoreId, requireCategory } from "./scope";
import { assertImageReferences } from "../storage";
import { ApiError } from "../api-helpers";
import { removeCategory } from "../catalog-deletion";

export interface AdminCategoryRow {
  slug: string;
  name: string;
  icon: string;
  gradient: string;
  imageUrl: string | null;
  description: string | null;
  count: number;
}

export interface CategoryInput {
  slug: string;
  name: string;
  icon: string;
  gradient: string;
  imageUrl?: string | null;
  description?: string;
}

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  const storeId = await adminStoreId();
  const rows = await prisma.category.findMany({
    where: { storeId },
    include: { _count: { select: { products: { where: { storeId } } } } },
    orderBy: { name: "asc" },
  });
  return rows.map((c) => ({
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    gradient: c.gradient,
    imageUrl: c.imageUrl,
    description: c.description,
    count: c._count.products,
  }));
}

export async function createCategory(input: CategoryInput) {
  const storeId = await adminStoreId();
  await assertImageReferences([input.imageUrl]);
  const dup = await prisma.category.findUnique({ where: { storeId_slug: { storeId, slug: input.slug } } });
  if (dup) throw new ApiError(409, "Ya existe una categoría con ese slug");
  return prisma.category.create({
    data: {
      ...input,
      storeId,
      imageUrl: input.imageUrl || null,
      description: input.description ?? null,
    },
  });
}

export async function updateCategory(slug: string, input: Omit<CategoryInput, "slug">) {
  const storeId = await adminStoreId();
  await requireCategory(slug, storeId);
  await assertImageReferences([input.imageUrl]);
  const updated = await prisma.category
    .update({
      where: { storeId_slug: { storeId, slug } },
      data: {
        ...input,
        imageUrl: input.imageUrl || null,
        description: input.description ?? null,
      },
    })
    .catch(() => null);
  if (!updated) throw new ApiError(404, "Categoría no encontrada");
  return updated;
}

export async function deleteCategory(slug: string): Promise<void> {
  const storeId = await adminStoreId();
  await requireCategory(slug, storeId);
  const count = await prisma.product.count({ where: { storeId, categorySlug: slug } });
  if (count > 0) {
    throw new ApiError(
      409,
      `No puedes eliminar esta categoría: tiene ${count} producto(s). Muévelos primero.`,
    );
  }
  await prisma.$transaction((tx) => removeCategory(tx, slug)).catch(() => {
    throw new ApiError(404, "Categoría no encontrada");
  });
}
