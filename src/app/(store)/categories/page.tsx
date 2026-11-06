import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CategoryVisual } from "@/components/category-visual";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
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
      <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Todas las categorías
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {categories.length} categorías para explorar.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => {
          const count = countFor(c.slug);
          return (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <CategoryVisual
                category={c}
                className="size-14 rounded-full ring-1 ring-border transition-transform group-hover:scale-105"
                iconClassName="size-6"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading font-semibold group-hover:text-primary">
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
    </div>
  );
}
