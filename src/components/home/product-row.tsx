import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/product/product-card";
import { SectionHeader } from "@/components/home/section-header";
import { BannerCard } from "@/components/home/banner-card";
import type { Banner, Product } from "@/types";
import type { SectionBannerPosition } from "@/lib/server/home";

/**
 * Fila de productos del inicio. Puede llevar un banner destacado a la
 * izquierda/derecha (comparte la fila) o arriba/abajo (ancho completo), y un
 * fondo propio para la sección: color, imagen de campaña, o ambos.
 */
export function ProductRow({
  title,
  href,
  products,
  banner = null,
  bannerPosition = null,
  bgClass = null,
  bgImageUrl = null,
  bgOverlay = 0,
}: {
  title: string;
  href?: string;
  products: Product[];
  banner?: Banner | null;
  /** `null` = la fila no lleva banner destacado. */
  bannerPosition?: SectionBannerPosition | null;
  bgClass?: string | null;
  bgImageUrl?: string | null;
  bgOverlay?: number;
}) {
  const inline = banner && (bannerPosition === "LEFT" || bannerPosition === "RIGHT");
  const stacked = banner && (bannerPosition === "TOP" || bannerPosition === "BOTTOM");
  const hasBg = !!bgClass || !!bgImageUrl;

  const grid = (
    <div
      className={cn(
        "grid gap-3",
        inline
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
      )}
    >
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );

  const wideBanner = banner && (
    <BannerCard banner={banner} size="md" className="h-40 sm:h-48" />
  );

  return (
    <section
      className={cn(
        hasBg && "relative overflow-hidden rounded-2xl p-4 sm:p-6",
        // Debajo de la imagen: se ve mientras carga y si la URL falla.
        bgClass,
      )}
    >
      {bgImageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL externa definida por el admin */}
          <img
            src={bgImageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          />
          {bgOverlay > 0 && (
            <span
              aria-hidden
              className="absolute inset-0 bg-black"
              style={{ opacity: bgOverlay / 100 }}
            />
          )}
        </>
      )}

      <div className={cn(hasBg && "relative")}>
        <SectionHeader title={title} href={href} onDark={hasBg} />

        {stacked ? (
          <div className="space-y-4">
            {bannerPosition === "TOP" && wideBanner}
            {grid}
            {bannerPosition === "BOTTOM" && wideBanner}
          </div>
        ) : inline ? (
          <div
            className={cn(
              "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
              bannerPosition === "RIGHT" &&
                "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
            )}
          >
            {bannerPosition === "LEFT" && (
              <BannerCard banner={banner} size="md" className="h-56 lg:h-full" />
            )}
            {grid}
            {bannerPosition === "RIGHT" && (
              <BannerCard banner={banner} size="md" className="h-56 lg:h-full" />
            )}
          </div>
        ) : (
          grid
        )}
      </div>
    </section>
  );
}
