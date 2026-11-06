"use client";

import * as React from "react";
import { SlidersHorizontal, ArrowDownWideNarrow } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ProductGrid } from "@/components/catalog/product-grid";
import {
  FilterSidebar,
  type FilterState,
} from "@/components/catalog/filter-sidebar";
import type { Product } from "@/types";
import type { SortKey } from "@/lib/queries";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevancia" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "rating", label: "Mejor calificados" },
  { value: "discount", label: "Mayor descuento" },
];

function discount(p: Product) {
  return p.oldPrice ? (p.oldPrice - p.price) / p.oldPrice : 0;
}

export function CatalogView({
  products,
  brands,
  /** Orden inicial, p.ej. cuando se llega desde /search?sort=rating. */
  initialSort = "relevance",
}: {
  products: Product[];
  brands: string[];
  initialSort?: SortKey;
}) {
  const priceBounds = React.useMemo(() => {
    const prices = products.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices, 0)),
      max: Math.ceil(Math.max(...prices, 100)),
    };
  }, [products]);

  const initial: FilterState = {
    brands: [],
    minRating: 0,
    maxPrice: priceBounds.max,
    onlyDeals: false,
  };

  const [filters, setFilters] = React.useState<FilterState>(initial);
  const [sort, setSort] = React.useState<SortKey>(initialSort);

  const onChange = (patch: Partial<FilterState>) =>
    setFilters((f) => ({ ...f, ...patch }));
  const onReset = () => setFilters({ ...initial });

  const filtered = React.useMemo(() => {
    let list = products.filter((p) => p.price <= filters.maxPrice);
    if (filters.onlyDeals) list = list.filter((p) => p.oldPrice);
    if (filters.minRating) list = list.filter((p) => p.rating >= filters.minRating);
    if (filters.brands.length)
      list = list.filter((p) => filters.brands.includes(p.brand));

    const arr = [...list];
    switch (sort) {
      case "price-asc":
        return arr.sort((a, b) => a.price - b.price);
      case "price-desc":
        return arr.sort((a, b) => b.price - a.price);
      case "rating":
        return arr.sort((a, b) => b.rating - a.rating);
      case "discount":
        return arr.sort((a, b) => discount(b) - discount(a));
      default:
        return arr;
    }
  }, [products, filters, sort]);

  const sortSelect = (
    <div className="relative">
      <ArrowDownWideNarrow className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
        aria-label="Ordenar por"
        className="h-9 appearance-none rounded-md border border-border bg-background pl-8 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      {/* Barra superior: conteo + orden + filtros móvil */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {filtered.length}
          </span>{" "}
          {filtered.length === 1 ? "producto" : "productos"}
        </p>
        <div className="flex items-center gap-2">
          {sortSelect}
          {/* Filtros en móvil */}
          <Sheet>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "h-9 gap-2 lg:hidden",
              )}
            >
              <SlidersHorizontal className="size-4" />
              Filtros
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader className="sr-only">
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <FilterSidebar
                  brands={brands}
                  priceBounds={priceBounds}
                  state={filters}
                  onChange={onChange}
                  onReset={onReset}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar desktop */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-40 rounded-lg border border-border bg-card p-4">
            <FilterSidebar
              brands={brands}
              priceBounds={priceBounds}
              state={filters}
              onChange={onChange}
              onReset={onReset}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <ProductGrid products={filtered} />
        </div>
      </div>
    </div>
  );
}
