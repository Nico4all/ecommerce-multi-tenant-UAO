"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { Separator } from "@/components/ui/separator";
import { RatingStars } from "@/components/product/rating-stars";

export interface FilterState {
  brands: string[];
  minRating: number;
  maxPrice: number;
  onlyDeals: boolean;
}

const RATINGS = [4, 3, 2, 0] as const;

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
  // El panel se monta dos veces: barra lateral en escritorio y hoja lateral en
  // móvil. Con un `name` fijo los dos grupos de radios se fundían en uno solo,
  // y las flechas del teclado recorrían los ocho controles de las dos copias.
  const radioName = `rating-${React.useId()}`;

  const toggleBrand = (brand: string) => {
    const next = state.brands.includes(brand)
      ? state.brands.filter((b) => b !== brand)
      : [...state.brands, brand];
    onChange({ brands: next });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
          {/* Mismo remate rojo que encabeza las secciones del inicio. */}
          <span aria-hidden className="h-4 w-1 shrink-0 rounded-full bg-brand" />
          Filtros
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs text-muted-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="size-3" aria-hidden />
          Limpiar
        </button>
      </div>

      {/* Precio */}
      <div>
        <label
          htmlFor={`${radioName}-price`}
          className="mb-2 block text-sm font-medium"
        >
          Precio máximo
        </label>
        <input
          id={`${radioName}-price`}
          type="range"
          min={priceBounds.min}
          max={priceBounds.max}
          value={state.maxPrice}
          onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          // El número en pesos, no el crudo: con aria-valuetext el lector dice
          // "$ 140.000" en vez de "140000".
          aria-valuetext={formatPrice(state.maxPrice)}
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
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span className="text-sm font-medium">Solo ofertas</span>
        <input
          type="checkbox"
          checked={state.onlyDeals}
          onChange={(e) => onChange({ onlyDeals: e.target.checked })}
          className="size-4 accent-primary"
        />
      </label>

      <Separator />

      {/* Calificación. Va en fieldset para que el grupo tenga nombre: sin él,
          cada radio se anuncia suelto y no se sabe de qué es la calificación. */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Calificación</legend>
        <div className="space-y-1">
          {RATINGS.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name={radioName}
                checked={state.minRating === r}
                onChange={() => onChange({ minRating: r })}
                className="size-3.5 accent-primary"
              />
              {r === 0 ? (
                <span className="text-muted-foreground">Todas</span>
              ) : (
                <span className="flex items-center gap-1">
                  <RatingStars rating={r} />
                  <span className="text-muted-foreground">y más</span>
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      {brands.length > 0 && (
        <>
          <Separator />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Marca</legend>
            {/* Con muchas marcas la lista empujaba el panel hasta dejar el
                botón de limpiar fuera de la vista en la hoja del móvil. */}
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {brands.map((brand) => (
                <label
                  key={brand}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                  <input
                    type="checkbox"
                    checked={state.brands.includes(brand)}
                    onChange={() => toggleBrand(brand)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 truncate">{brand}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}
