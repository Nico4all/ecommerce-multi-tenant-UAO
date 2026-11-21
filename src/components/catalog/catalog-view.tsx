"use client";

import * as React from "react";
import {
  SlidersHorizontal,
  ArrowDownWideNarrow,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ProductGrid, EmptyState } from "@/components/catalog/product-grid";
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

function emptyFilters(maxPrice: number): FilterState {
  return { brands: [], minRating: 0, maxPrice, onlyDeals: false };
}

export function CatalogView({
  products,
  brands,
  /** Orden inicial, p.ej. cuando se llega desde /search?sort=rating. */
  initialSort = "relevance",
  /**
   * Qué decir cuando la fuente no trae ningún producto. Es distinto de que los
   * filtros hayan descartado todo, que se resuelve aquí porque solo esta vista
   * sabe qué filtros hay puestos.
   */
  emptyTitle = "No encontramos productos",
  emptyHint,
}: {
  products: Product[];
  brands: string[];
  initialSort?: SortKey;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const priceBounds = React.useMemo(() => {
    const prices = products.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices, 0)),
      max: Math.ceil(Math.max(...prices, 100)),
    };
  }, [products]);

  const [filters, setFilters] = React.useState<FilterState>(() =>
    emptyFilters(priceBounds.max),
  );
  const [sort, setSort] = React.useState<SortKey>(initialSort);

  // Cuando cambia el conjunto de productos (otra categoría, otra búsqueda), los
  // filtros del conjunto anterior dejan de tener sentido: las marcas pueden no
  // existir aquí y, sobre todo, un tope de precio heredado de un catálogo
  // barato escondía sin avisar los productos caros del nuevo. Se reinician
  // durante el render, que es como React indica ajustar estado ante un cambio
  // de props, sin pasar por un efecto ni por un segundo repintado visible.
  const [seenMax, setSeenMax] = React.useState(priceBounds.max);
  if (seenMax !== priceBounds.max) {
    setSeenMax(priceBounds.max);
    setFilters(emptyFilters(priceBounds.max));
  }

  // Lo mismo con el orden que llega por URL: los enlaces del pie cambian
  // ?sort= sin remontar la vista, y el select se quedaba en el valor viejo.
  const [seenSort, setSeenSort] = React.useState(initialSort);
  if (seenSort !== initialSort) {
    setSeenSort(initialSort);
    setSort(initialSort);
  }

  const onChange = (patch: Partial<FilterState>) =>
    setFilters((f) => ({ ...f, ...patch }));
  const onReset = () => setFilters(emptyFilters(priceBounds.max));

  const activeCount =
    (filters.brands.length > 0 ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.onlyDeals ? 1 : 0) +
    (filters.maxPrice < priceBounds.max ? 1 : 0);

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

  const panel = (
    <FilterSidebar
      brands={brands}
      priceBounds={priceBounds}
      state={filters}
      onChange={onChange}
      onReset={onReset}
    />
  );

  // Sin productos de origen no hay nada que limpiar; con filtros puestos, sí.
  const empty =
    products.length === 0 ? (
      <EmptyState title={emptyTitle} hint={emptyHint} />
    ) : (
      <EmptyState
        title="Ningún producto coincide con los filtros"
        hint="Ajusta el precio, la calificación o las marcas para ver más resultados."
        action={
          <button
            type="button"
            onClick={onReset}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <RotateCcw className="size-4" aria-hidden />
            Limpiar filtros
          </button>
        }
      />
    );

  return (
    <div>
      {/* Barra superior: conteo + orden + filtros móvil */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* El conteo cambia al filtrar sin que nada se mueva de sitio, así que
            se anuncia: para quien no ve la rejilla es la única señal de que el
            filtro surtió efecto. */}
        <p aria-live="polite" className="shrink-0 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {filtered.length}
          </span>{" "}
          {filtered.length === 1 ? "producto" : "productos"}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <ArrowDownWideNarrow
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Ordenar por"
              className="h-9 appearance-none rounded-md border border-border bg-card pl-8 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {/* El hueco de la derecha ya estaba reservado con pr-8, pero no
                había nada dentro: el select no parecía desplegable. */}
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>

          {/* Filtros en móvil */}
          <Sheet>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "h-9 gap-2 lg:hidden",
              )}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Filtros
              {/* Con el panel cerrado no había forma de saber que quedaban
                  filtros puestos, y la lista parecía corta sin motivo. */}
              {activeCount > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-foreground tabular-nums">
                  {activeCount}
                  <span className="sr-only">
                    {activeCount === 1 ? " filtro activo" : " filtros activos"}
                  </span>
                </span>
              )}
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader className="sr-only">
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              {/* La X de cerrar de la hoja va en absolute top-3 right-3 y
                  caia justo encima del boton "Limpiar" de la primera fila.
                  El hueco superior deja el panel por debajo de ella. */}
              <div className="p-4 pt-14">{panel}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar escritorio */}
        <aside aria-label="Filtros" className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-40 rounded-xl border border-border bg-card p-4">
            {panel}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <ProductGrid products={filtered} empty={empty} />
        </div>
      </div>
    </div>
  );
}
