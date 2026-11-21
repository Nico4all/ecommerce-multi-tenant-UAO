import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CategoryVisual } from "@/components/category-visual";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { EmptyState } from "@/components/catalog/product-grid";
import { getCategories, getProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Todas las categorías — Variedades Los Primos",
  description:
    "Explora todas las categorías de Variedades Los Primos y encuentra productos para el hogar, moda, belleza, tecnología y más.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(),
  ]);

  const countFor = (slug: string) =>
    products.filter((p) => p.category === slug).length;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <Breadcrumbs items={[{ label: "Categorías" }]} />
      {/* Mismo remate rojo que encabeza las secciones del inicio: el rojo
          entra como elemento gráfico, donde le basta 3:1. */}
      <h1 className="flex items-center gap-3 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-brand" />
        Todas las categorías
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        {categories.length}{" "}
        {categories.length === 1 ? "categoría" : "categorías"} para explorar.
      </p>

      {categories.length === 0 ? (
        <EmptyState
          title="Todavía no hay categorías"
          hint="En cuanto se publiquen aparecerán aquí."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => {
            const count = countFor(c.slug);
            return (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <CategoryVisual
                  category={c}
                  className="size-14 rounded-full ring-1 ring-border transition-transform group-hover:scale-105"
                  iconClassName="size-6"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-heading font-semibold leading-snug group-hover:text-primary">
                    {c.name}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {count} {count === 1 ? "producto" : "productos"}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
