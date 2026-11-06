import "server-only";
import { z } from "zod";
import { imageRefSchema, MAX_PRODUCT_IMAGES } from "@/lib/image-limits";

/** Esquemas zod de los endpoints /api/admin/** (los route.ts no pueden exportarlos). */

export const productSchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto"),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug inválido (solo minúsculas, números y guiones)"),
  brand: z.string().trim().min(1, "Escribe la marca"),
  description: z.string().trim().optional(),
  categorySlug: z.string().min(1, "Selecciona una categoría"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  offerPrice: z.number().positive().nullable().optional(),
  offerActive: z.boolean().optional(),
  cost: z.number().min(0, "El costo no puede ser negativo").nullable().optional(),
  stock: z.number().int().min(0).optional(),
  sku: z.string().trim().nullable().optional(),
  status: z.enum(["PUBLISHED", "DRAFT", "ARCHIVED"]).optional(),
  featured: z.boolean().optional(),
  // Costo de envío propio: null = tarifa general, 0 = envío gratis, >0 = fijo.
  shippingCost: z
    .number()
    .min(0, "El costo de envío no puede ser negativo")
    .nullable()
    .optional(),
  badge: z.string().trim().nullable().optional(),
  specs: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  variants: z
    .array(
      z.object({
        name: z.string().trim().min(1, "El color/variante necesita nombre"),
        colorHex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
          .nullable()
          .optional(),
        stock: z.number().int().min(0),
      }),
    )
    .optional(),
  /** Galería, en orden. La primera es la principal. */
  images: z
    .array(imageRefSchema)
    .max(MAX_PRODUCT_IMAGES, `Máximo ${MAX_PRODUCT_IMAGES} fotos por producto`)
    .optional(),
});

export const offerSchema = z.object({
  offerActive: z.boolean(),
  offerPrice: z.number().positive("El precio de oferta debe ser mayor a 0").nullable().optional(),
});

export const categorySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug inválido (solo minúsculas, números y guiones)"),
  name: z.string().trim().min(2, "Nombre muy corto"),
  icon: z.string().trim().min(1, "Elige un icono"),
  gradient: z.string().trim().min(1),
  imageUrl: imageRefSchema.nullable().optional(),
  description: z.string().trim().optional(),
});

export const discountSchema = z.object({
  code: z.string().trim().min(3, "Código muy corto").toUpperCase(),
  type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING", "GIFT_CARD"]),
  value: z.number().min(0).optional(),
  minPurchase: z.number().min(0).nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  status: z.enum(["ACTIVE", "SCHEDULED", "EXPIRED", "DISABLED"]).optional(),
  startsAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

export const bannerSchema = z
  .object({
    placement: z.enum(["HERO", "HERO_SIDE", "PROMO", "STRIP"]),
    /** Sección de banners a la que pertenece (null para HERO/HERO_SIDE). */
    sectionId: z.string().nullable().optional(),
    title: z.string().trim().nullable().optional(),
    subtitle: z.string().trim().nullable().optional(),
    highlight: z.string().trim().nullable().optional(),
    ctaText: z.string().trim().nullable().optional(),
    href: z.string().trim().min(1, "Escribe el enlace"),
    imageUrl: imageRefSchema.nullable().optional(),
    bgClass: z.string().trim().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  // El texto y el botón son opcionales, pero un banner sin imagen NI texto sería
  // un rectángulo de color vacío. Tiene que traer al menos una de las dos cosas.
  .refine((v) => !!v.imageUrl || !!v.title || !!v.highlight, {
    message: "Un banner necesita al menos una imagen o un título",
    path: ["imageUrl"],
  });

export const homeSectionSchema = z
  .object({
    kind: z.enum(["HERO", "CATEGORIES", "PRODUCTS", "BANNERS"]),
    title: z.string().trim().nullable().optional(),
    source: z
      .enum(["OFFERS", "CATEGORY", "FEATURED", "NEWEST", "TOP_RATED"])
      .nullable()
      .optional(),
    categorySlug: z.string().trim().nullable().optional(),
    maxItems: z.number().int().min(1).max(20).optional(),
    href: z.string().trim().nullable().optional(),
    bannerLayout: z.enum(["GRID", "WIDE"]).nullable().optional(),
    bannerPosition: z.enum(["LEFT", "RIGHT", "TOP", "BOTTOM"]).nullable().optional(),
    bgClass: z.string().trim().nullable().optional(),
    bgImageUrl: imageRefSchema.nullable().optional(),
    bgOverlay: z.number().int().min(0).max(100).optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.kind !== "PRODUCTS" || (v.title && v.title.trim().length >= 2), {
    message: "La fila de productos necesita un título",
    path: ["title"],
  })
  .refine(
    (v) => v.kind !== "PRODUCTS" || v.source !== "CATEGORY" || !!v.categorySlug,
    { message: "Elige la categoría de la que saldrán los productos", path: ["categorySlug"] },
  );

export const moveSectionSchema = z.object({
  direction: z.enum(["up", "down"]),
});

export const orderUpdateSchema = z.object({
  status: z
    .enum([
      "PENDING",
      "PAID",
      "PACKING",
      "SHIPPED",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
    ])
    .optional(),
  carrier: z.string().trim().nullable().optional(),
  trackingNumber: z.string().trim().nullable().optional(),
  trackingUrl: z
    .union([z.url("El enlace de rastreo debe ser una URL válida"), z.literal("")])
    .nullable()
    .optional(),
});

export const orderEmailSchema = z.object({
  includeTracking: z.boolean().default(true),
});

export const userSchema = z
  .object({
    name: z.string().trim().min(2, "Nombre muy corto"),
    email: z.email("Correo inválido").trim().toLowerCase(),
    phone: z.string().trim().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    /** Rol al crear. En edición no se envía (se mantiene el actual). */
    role: z.enum(["ADMIN", "CUSTOMER"]).optional(),
    /** Contraseña inicial. Obligatoria para un admin; opcional para un cliente. */
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .optional(),
    address: z
      .object({
        street: z.string().trim().min(3),
        city: z.string().trim().min(2),
        state: z.string().trim().min(2),
        zip: z.string().trim().min(3),
        country: z.string().trim().min(2),
      })
      .optional(),
  })
  // Un admin sin contraseña no podría entrar (no hay "invitación" para el panel).
  .refine((v) => v.role !== "ADMIN" || !!v.password, {
    message: "Un administrador necesita una contraseña inicial",
    path: ["password"],
  });

/** Fijar la contraseña de un usuario desde el panel (reset por admin). */
export const adminPasswordSchema = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
