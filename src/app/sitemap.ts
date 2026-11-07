import type { MetadataRoute } from "next";
import { prisma, getStoreContext } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const publicRoutes: Array<{
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/categories", changeFrequency: "weekly", priority: 0.8 },
  { path: "/deals", changeFrequency: "daily", priority: 0.8 },
  { path: "/ayuda", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contacto", changeFrequency: "monthly", priority: 0.5 },
  { path: "/pqr", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terminos", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacidad", changeFrequency: "yearly", priority: 0.2 },
  { path: "/datos-personales", changeFrequency: "yearly", priority: 0.2 },
  { path: "/retracto", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { origin } = await getStoreContext();
  const staticEntries: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: new URL(route.path, origin).toString(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({ select: { slug: true } }),
      prisma.product.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      ...staticEntries,
      ...categories.map((category) => ({
        url: `${origin}/category/${encodeURIComponent(category.slug)}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...products.map((product) => ({
        url: `${origin}/product/${encodeURIComponent(product.slug)}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch (error) {
    console.error("No se pudo añadir el catálogo dinámico al sitemap", error);
    return staticEntries;
  }
}
