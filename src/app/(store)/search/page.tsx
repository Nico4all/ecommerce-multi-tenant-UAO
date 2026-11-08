import type { Metadata } from "next";
import { getProducts, getBrands, type SortKey } from "@/lib/queries";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CatalogView } from "@/components/catalog/catalog-view";

export const metadata: Metadata = {
  title: "Buscar — Variedades Los Primos",
  robots: { index: false, follow: true },
};

const SORTS: SortKey[] = [
  "relevance",
  "price-asc",
  "price-desc",
  "rating",
  "discount",
];

/** Título según el orden pedido, para que el enlace del footer se explique solo. */
const SORT_TITLE: Partial<Record<SortKey, string>> = {
  rating: "Mejor calificados",
  discount: "Mayor descuento",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q = "", sort } = await searchParams;
  // El orden llega por URL (lo usan los enlaces del footer); si no es válido,
  // manda la relevancia.
  const initialSort: SortKey = SORTS.includes(sort as SortKey)
    ? (sort as SortKey)
    : "relevance";

  const [products, brands] = await Promise.all([
    getProducts({ search: q, sort: initialSort }),
    getBrands(),
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <Breadcrumbs items={[{ label: "Búsqueda" }]} />
      <h1 className="mb-5 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        {q ? (
          <>
            Resultados para{" "}
            <span className="text-primary">&ldquo;{q}&rdquo;</span>
          </>
        ) : (
          (SORT_TITLE[initialSort] ?? "Todos los productos")
        )}
      </h1>
      <CatalogView
        products={products}
        brands={brands}
        initialSort={initialSort}
        emptyTitle={
          q ? `Sin resultados para "${q}"` : "Todavía no hay productos"
        }
        emptyHint={
          q
            ? "Revisa la ortografía, prueba con menos palabras o busca por categoría."
            : "Explora las categorías para ver lo que hay disponible."
        }
      />
    </div>
  );
}
