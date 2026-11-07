import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { requireAdmin } from "../auth";
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
  await requireAdmin();
  const rows = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
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
  await requireAdmin();
  const dup = await prisma.category.findUnique({ where: { storeId_slug: { storeId: (await getStoreContext()).id, slug: input.slug } } });
  if (dup) throw new ApiError(409, "Ya existe una categoría con ese slug");
  return prisma.category.create({
    data: {
      ...input,
      imageUrl: input.imageUrl || null,
      description: input.description ?? null,
    },
  });
}

export async function updateCategory(slug: string, input: Omit<CategoryInput, "slug">) {
  await requireAdmin();
  const updated = await prisma.category
    .update({
      where: { storeId_slug: { storeId: (await getStoreContext()).id, slug } },
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
  await requireAdmin();
  const count = await prisma.product.count({ where: { categorySlug: slug } });
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
