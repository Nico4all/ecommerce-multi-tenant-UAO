export type CategorySlug =
  | "electronica"
  | "moda"
  | "hogar"
  | "belleza"
  | "supermercado"
  | "deportes"
  | "juguetes"
  | "lujo";

export interface Category {
  slug: CategorySlug;
  name: string;
  /** lucide-react icon name key (mapped in icon-map) */
  icon: string;
  /** tailwind gradient utility pair for the category tile */
  gradient: string;
  /** imagen/SVG propia; si existe, reemplaza al icono */
  imageUrl?: string | null;
  /** Texto editorial administrable para la página y sus metadatos. */
  description?: string | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  price: number;
  /** precio anterior (para mostrar tachado) */
  oldPrice?: number;
  rating: number; // 0-5
  reviews: number;
  /**
   * Costo de envío propio. `undefined`/`null` = usa la tarifa general de la
   * tienda; `0` = este producto siempre envía gratis; `>0` = costo fijo propio.
   */
  shippingCost?: number | null;
  badge?: string; // p.ej. "Más vendido"
  /** Foto principal. Sin ella, la UI cae al mosaico de la categoría (Thumb). */
  imageUrl?: string | null;
}

export interface Banner {
  id: string;
  /** Todo el texto es opcional: un banner puede ser solo la imagen. */
  title?: string;
  subtitle?: string;
  highlight?: string; // texto destacado (p.ej. "50%")
  /** Sin texto de botón no se pinta botón; el banner entero sigue siendo enlace. */
  cta?: string;
  href: string;
  /** clases tailwind para el fondo del banner (si no hay imagen) */
  className: string;
  /** imagen de fondo; si existe, se muestra bajo el texto */
  imageUrl?: string | null;
}
