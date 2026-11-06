import { z } from "zod";
import { imageRefSchema } from "@/lib/image-limits";
import type {
  HomeSectionKind,
  ProductSource,
  SectionBannerPosition,
} from "@/lib/server/home";

/**
 * Esquema y etiquetas del formulario de secciones de la home.
 *
 * Vive fuera de `lib/server/admin/schemas.ts` porque aquél es `server-only`:
 * este lo usan las páginas de /admin/home/new y /admin/home/[id]/edit con
 * react-hook-form. La API valida igual por su cuenta.
 */

export const SOURCE_LABEL: Record<ProductSource, string> = {
  OFFERS: "En oferta (mayor descuento)",
  CATEGORY: "De una categoría",
  FEATURED: "Destacados",
  NEWEST: "Más recientes",
  TOP_RATED: "Mejor calificados",
};

export const KIND_LABEL: Record<HomeSectionKind, string> = {
  HERO: "Carrusel principal (hero)",
  CATEGORIES: "Círculos de categorías",
  PRODUCTS: "Fila de productos",
  BANNERS: "Banners",
};

/** "NONE" = la fila no lleva banner destacado; se guarda como `null`. */
export const POSITION_LABEL: Record<SectionBannerPosition | "NONE", string> = {
  NONE: "Sin banner destacado",
  LEFT: "Izquierda (junto a los productos)",
  RIGHT: "Derecha (junto a los productos)",
  TOP: "Arriba (ancho completo)",
  BOTTOM: "Abajo (ancho completo)",
};

export const homeSectionFormSchema = z
  .object({
    kind: z.enum(["HERO", "CATEGORIES", "PRODUCTS", "BANNERS"]),
    title: z.string().trim(),
    source: z.enum(["OFFERS", "CATEGORY", "FEATURED", "NEWEST", "TOP_RATED"]),
    categorySlug: z.string(),
    maxItems: z
      .number("Escribe cuántos productos")
      .int("Debe ser un número entero")
      .min(1, "Al menos 1 producto")
      .max(20, "Máximo 20 productos"),
    href: z.string().trim(),
    bannerLayout: z.enum(["GRID", "WIDE"]),
    bannerPosition: z.enum(["NONE", "LEFT", "RIGHT", "TOP", "BOTTOM"]),
    bgClass: z.string(),
    bgImageUrl: imageRefSchema,
    bgOverlay: z.number().int().min(0).max(100),
    active: z.boolean(),
  })
  .refine((v) => v.kind !== "PRODUCTS" || v.title.length >= 2, {
    message: "La fila de productos necesita un título",
    path: ["title"],
  })
  .refine(
    (v) => v.kind !== "PRODUCTS" || v.source !== "CATEGORY" || !!v.categorySlug,
    {
      message: "Elige la categoría de la que saldrán los productos",
      path: ["categorySlug"],
    },
  );

export type HomeSectionFormValues = z.infer<typeof homeSectionFormSchema>;

export const emptyHomeSection: HomeSectionFormValues = {
  kind: "PRODUCTS",
  title: "",
  source: "OFFERS",
  categorySlug: "",
  maxItems: 5,
  href: "",
  bannerLayout: "GRID",
  bannerPosition: "NONE",
  bgClass: "",
  bgImageUrl: "",
  bgOverlay: 0,
  active: true,
};

/** Valores del formulario → cuerpo que espera /api/admin/home-sections. */
export function toHomeSectionPayload(v: HomeSectionFormValues) {
  const isProducts = v.kind === "PRODUCTS";
  return {
    kind: v.kind,
    title: v.title || null,
    source: isProducts ? v.source : null,
    categorySlug: isProducts && v.source === "CATEGORY" ? v.categorySlug : null,
    maxItems: v.maxItems,
    href: v.href || null,
    bannerLayout: v.kind === "BANNERS" ? v.bannerLayout : null,
    bannerPosition:
      isProducts && v.bannerPosition !== "NONE" ? v.bannerPosition : null,
    bgClass: isProducts ? v.bgClass || null : null,
    bgImageUrl: isProducts ? v.bgImageUrl || null : null,
    bgOverlay: isProducts ? v.bgOverlay : 0,
    active: v.active,
  };
}
