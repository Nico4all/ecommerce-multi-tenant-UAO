import type { Metadata } from "next";
import { getProducts, getBrands } from "@/lib/queries";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CatalogView } from "@/components/catalog/catalog-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mejores ofertas — Variedades Los Primos",
  description:
    "Descubre las ofertas y descuentos disponibles en Variedades Los Primos, tienda online en Colombia.",
  alternates: { canonical: "/deals" },
};

export default async function DealsPage() {
  const [products, brands] = await Promise.all([
    getProducts({ onlyDeals: true, sort: "discount" }),
    getBrands(),
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <Breadcrumbs items={[{ label: "Mejores ofertas" }]} />
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Mejores ofertas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Los mayores descuentos de Variedades Los Primos, actualizados cada día.
        </p>
      </div>
      <CatalogView products={products} brands={brands} />
    </div>
  );
}
