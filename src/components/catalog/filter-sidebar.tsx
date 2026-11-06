"use client";

import { Star, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { Separator } from "@/components/ui/separator";

export interface FilterState {
  brands: string[];
  minRating: number;
  maxPrice: number;
  onlyDeals: boolean;
}

export function FilterSidebar({
  brands,
  priceBounds,
  state,
  onChange,
  onReset,
}: {
  brands: string[];
  priceBounds: { min: number; max: number };
  state: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
}) {
  const toggleBrand = (brand: string) => {
    const next = state.brands.includes(brand)
      ? state.brands.filter((b) => b !== brand)
      : [...state.brands, brand];
    onChange({ brands: next });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold">Filtros</h2>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <RotateCcw className="size-3" />
          Limpiar
        </button>
      </div>

      {/* Precio */}
      <div>
        <h3 className="mb-2 text-sm font-medium">Precio máximo</h3>
        <input
          type="range"
          min={priceBounds.min}
          max={priceBounds.max}
          value={state.maxPrice}
          onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          aria-label="Precio máximo"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatPrice(priceBounds.min)}</span>
          <span className="font-medium text-foreground">
            {formatPrice(state.maxPrice)}
          </span>
        </div>
      </div>

      <Separator />

      {/* Ofertas */}
      <label className="flex cursor-pointer items-center justify-between">
        <span className="text-sm font-medium">Solo ofertas</span>
        <input
          type="checkbox"
          checked={state.onlyDeals}
          onChange={(e) => onChange({ onlyDeals: e.target.checked })}
          className="size-4 accent-primary"
        />
      </label>

      <Separator />

      {/* Rating */}
      <div>
        <h3 className="mb-2 text-sm font-medium">Calificación</h3>
        <div className="space-y-1">
          {[4, 3, 2, 0].map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent"
            >
              <input
                type="radio"
                name="rating"
                checked={state.minRating === r}
                onChange={() => onChange({ minRating: r })}
                className="size-3.5 accent-primary"
              />
              {r === 0 ? (
                <span className="text-muted-foreground">Todas</span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "size-3.5",
                          i < r
                            ? "fill-amber-400 text-amber-400"
                            : "fill-muted text-muted-foreground/40",
                        )}
                      />
                    ))}
                  </span>
                  <span className="text-muted-foreground">y más</span>
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {brands.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-sm font-medium">Marca</h3>
            <div className="space-y-1">
              {brands.map((brand) => (
                <label
                  key={brand}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={state.brands.includes(brand)}
                    onChange={() => toggleBrand(brand)}
                    className="size-4 accent-primary"
                  />
                  {brand}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
