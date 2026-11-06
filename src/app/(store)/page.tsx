import type { Metadata } from "next";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { CategoryCircles } from "@/components/home/category-circles";
import { ProductRow } from "@/components/home/product-row";
import { PromoBanners } from "@/components/home/promo-banners";
import { PromoStrip } from "@/components/home/promo-strip";
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
 */
export default async function Home() {
  const sections = await getHomeLayout();

  return (
    <div className="mx-auto max-w-[1280px] space-y-12 px-4 py-6">
      <section className="rounded-2xl bg-muted/40 px-5 py-6 text-center sm:px-10">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
          Variedades Los Primos: tienda online en Colombia
        </h1>
        <p className="mx-auto mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
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
