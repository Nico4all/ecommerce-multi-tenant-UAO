import "server-only";
import { prisma } from "@/lib/prisma";
import { toDomainProduct, PRODUCT_IMAGE_INCLUDE } from "./mappers";
import { getProducts, getCategories } from "@/lib/queries";
import type { Banner, Category, Product } from "@/types";

/**
 * Composición de la página de inicio.
 *
 * La home es una lista ordenada de secciones configurables desde
 * /admin/home: el admin decide qué sale, en qué orden, con qué título y de
 * dónde salen los productos. Los banners viven en secciones propias, así que
 * pueden ir arriba o debajo de cualquier fila de productos.
 */

export type HomeSectionKind = "HERO" | "CATEGORIES" | "PRODUCTS" | "BANNERS";
export type ProductSource =
  | "OFFERS"
  | "CATEGORY"
  | "FEATURED"
  | "NEWEST"
  | "TOP_RATED";
export type BannerLayout = "GRID" | "WIDE";
export type SectionBannerPosition = "LEFT" | "RIGHT" | "TOP" | "BOTTOM";

export interface HomeSectionConfig {
  id: string;
  kind: HomeSectionKind;
  title: string | null;
  source: ProductSource | null;
  categorySlug: string | null;
  maxItems: number;
  href: string | null;
  bannerLayout: BannerLayout | null;
  /** `null` = la fila no lleva banner destacado. */
  bannerPosition: SectionBannerPosition | null;
  bgClass: string | null;
  bgImageUrl: string | null;
  bgOverlay: number;
  sortOrder: number;
  active: boolean;
}

/** Sección ya resuelta con su contenido, lista para renderizar. */
export type ResolvedSection =
  | { id: string; kind: "HERO"; slides: Banner[]; sides: Banner[] }
  | { id: string; kind: "CATEGORIES"; categories: Category[] }
  | {
      id: string;
      kind: "PRODUCTS";
      title: string;
      href: string;
      products: Product[];
      /** Banner destacado que acompaña a la fila (opcional). */
      banner: Banner | null;
      /** `null` cuando la fila no lleva banner destacado. */
      bannerPosition: SectionBannerPosition | null;
      /** Fondo de la sección completa (opcional). */
      bgClass: string | null;
      /** Imagen de fondo de la sección (opcional); manda sobre `bgClass`. */
      bgImageUrl: string | null;
      /** Oscurecido 0-100 sobre la imagen de fondo. */
      bgOverlay: number;
    }
  | { id: string; kind: "BANNERS"; layout: BannerLayout; banners: Banner[] };

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

/** Destino de "Ver todo" cuando el admin no lo define. */
function defaultHref(source: ProductSource | null, categorySlug: string | null) {
  if (source === "CATEGORY" && categorySlug) return `/category/${categorySlug}`;
  if (source === "OFFERS") return "/deals";
  return "/search";
}

async function productsFor(section: HomeSectionConfig): Promise<Product[]> {
  const take = section.maxItems || 5;
  switch (section.source) {
    case "OFFERS":
      return (await getProducts({ onlyDeals: true, sort: "discount" })).slice(0, take);
    case "CATEGORY":
      return (
        await getProducts({ category: section.categorySlug ?? undefined })
      ).slice(0, take);
    case "TOP_RATED":
      return (await getProducts({ sort: "rating" })).slice(0, take);
    case "FEATURED": {
      const rows = await prisma.product.findMany({
        where: { status: "PUBLISHED", featured: true },
        take,
        orderBy: { createdAt: "desc" },
        include: PRODUCT_IMAGE_INCLUDE,
      });
      return rows.map(toDomainProduct);
    }
    case "NEWEST": {
      const rows = await prisma.product.findMany({
        where: { status: "PUBLISHED" },
        take,
        orderBy: { createdAt: "desc" },
        include: PRODUCT_IMAGE_INCLUDE,
      });
      return rows.map(toDomainProduct);
    }
    default:
      return (await getProducts()).slice(0, take);
  }
}

/** Secciones activas resueltas, en orden. */
export async function getHomeLayout(): Promise<ResolvedSection[]> {
  const sections = await prisma.homeSection.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  const resolved: ResolvedSection[] = [];
  for (const s of sections as HomeSectionConfig[]) {
      switch (s.kind) {
        case "HERO": {
          const rows = await prisma.banner.findMany({
            where: {
              active: true,
              placement: { in: ["HERO", "HERO_SIDE"] },
            },
            orderBy: { sortOrder: "asc" },
          });
          const slides = rows.filter((b) => b.placement === "HERO").map(toBanner);
          const sides = rows
            .filter((b) => b.placement === "HERO_SIDE")
            .map(toBanner);
          if (slides.length === 0 && sides.length === 0) break; // nada que mostrar
          resolved.push({ id: s.id, kind: "HERO", slides, sides });
          break;
        }
        case "CATEGORIES": {
          resolved.push({
            id: s.id,
            kind: "CATEGORIES",
            categories: await getCategories(),
          });
          break;
        }
        case "PRODUCTS": {
          const products = await productsFor(s);
          if (products.length === 0) break; // no dejar filas vacías
          // El banner destacado solo se busca si el admin eligió dónde ponerlo;
          // sin posición la fila se muestra sin banner aunque tenga uno asignado.
          const featured = s.bannerPosition
            ? await prisma.banner.findFirst({
                where: { active: true, sectionId: s.id },
                orderBy: { sortOrder: "asc" },
              })
            : null;
          resolved.push({
            id: s.id,
            kind: "PRODUCTS",
            title: s.title ?? "Productos",
            href: s.href || defaultHref(s.source, s.categorySlug),
            products,
            banner: featured ? toBanner(featured) : null,
            bannerPosition: featured ? s.bannerPosition : null,
            bgClass: s.bgClass,
            bgImageUrl: s.bgImageUrl,
            bgOverlay: s.bgOverlay,
          });
          break;
        }
        case "BANNERS": {
          const rows = await prisma.banner.findMany({
            where: { active: true, sectionId: s.id },
            orderBy: { sortOrder: "asc" },
          });
          if (rows.length === 0) break;
          resolved.push({
            id: s.id,
            kind: "BANNERS",
            layout: s.bannerLayout ?? "GRID",
            banners: rows.map(toBanner),
          });
          break;
        }
      }
    }
  return resolved;
}
