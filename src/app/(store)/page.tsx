import type { Metadata } from "next";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { CategoryCircles } from "@/components/home/category-circles";
import { ProductRow } from "@/components/home/product-row";
import { PromoBanners } from "@/components/home/promo-banners";
import { PromoStrip } from "@/components/home/promo-strip";
import { DEFAULT_STORE_BRAND } from "@/components/layout/store-brand";
import { getHomeLayout } from "@/lib/server/home";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE_NAME} | Tienda online en Colombia`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    locale: "es_CO",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Tienda online en Colombia`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Tienda online en Colombia`,
    description: SITE_DESCRIPTION,
  },
};

/**
 * La home se compone desde /admin/home: cada sección (hero, categorías, filas
 * de productos y banners) sale de la BD con su orden, título y fuente.
 *
 * La cabecera editorial de arriba no es una sección configurable: es el texto
 * que sostiene el H1 y la descripción de la página. El nombre y el lema salen
 * de la marca de la tienda, no escritos a mano, para que una segunda tienda no
 * herede el nombre de la primera.
 */
export default async function Home() {
  const sections = await getHomeLayout();
  const brand = DEFAULT_STORE_BRAND;

  return (
    <div className="mx-auto max-w-[1280px] space-y-10 px-4 py-6 sm:space-y-14">
      {/* Composición editorial: la regla roja al borde es el único rojo de
          este bloque. Sobre crema rinde 3.66:1, que alcanza para un elemento
          gráfico (1.4.11) pero no para texto pequeño, así que el lema va en el
          subordinado #AC0B32 (7.4:1). */}
      <section className="relative overflow-hidden rounded-2xl bg-card px-5 py-7 shadow-sm sm:px-10 sm:py-9">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-brand" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {brand.tagline}
        </p>
        <h1 className="mt-2 font-heading text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {brand.name}
          <span className="mt-1 block text-base font-semibold text-muted-foreground sm:text-lg">
            Tienda online en Colombia
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Encuentra productos para el hogar, moda, belleza, tecnología y más,
          con compra segura y atención desde Cali para Colombia.
        </p>
      </section>

      {sections.map((s) => {
        switch (s.kind) {
          case "HERO":
            return <HeroCarousel key={s.id} slides={s.slides} sides={s.sides} />;
          case "CATEGORIES":
            return <CategoryCircles key={s.id} categories={s.categories} />;
          case "PRODUCTS":
            return (
              <ProductRow
                key={s.id}
                title={s.title}
                href={s.href}
                products={s.products}
                banner={s.banner}
                bannerPosition={s.bannerPosition}
                bgClass={s.bgClass}
                bgImageUrl={s.bgImageUrl}
                bgOverlay={s.bgOverlay}
              />
            );
          case "BANNERS":
            return s.layout === "WIDE" ? (
              <PromoStrip key={s.id} banners={s.banners} />
            ) : (
              <PromoBanners key={s.id} banners={s.banners} />
            );
        }
      })}
    </div>
  );
}
