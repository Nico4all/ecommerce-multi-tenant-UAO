"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Thumb } from "@/components/product/thumb";
import { ProductImage } from "@/components/product/product-image";
import type { CategorySlug } from "@/types";

/**
 * Galería del producto.
 *
 * Con fotos propias se muestran esas y sus miniaturas. Sin fotos se conserva la
 * maqueta de "frente / lateral / detalle / empaque" (cuatro veces el mismo
 * mosaico), que es lo que la tienda enseña para el catálogo de ejemplo.
 */
export function ProductGallery({
  category,
  name,
  images = [],
}: {
  category: CategorySlug;
  name: string;
  images?: string[];
}) {
  const mockViews = ["frente", "lateral", "detalle", "empaque"];
  const [active, setActive] = React.useState(0);

  // Si el admin reordena o borra fotos, el índice guardado puede quedar fuera.
  const index = Math.min(active, Math.max(0, images.length - 1));

  if (images.length > 0) {
    return (
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto sm:flex-col sm:overflow-visible">
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                onClick={() => setActive(i)}
                aria-label={`Ver foto ${i + 1} de ${images.length}`}
                aria-pressed={index === i}
                className={cn(
                  "size-16 shrink-0 overflow-hidden rounded-md border-2 bg-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  index === i
                    ? "border-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ruta subida o URL externa del admin */}
                <img
                  src={src}
                  alt=""
                  aria-hidden
                  className="size-full object-contain"
                />
              </button>
            ))}
          </div>
        )}

        <div className="relative flex-1">
          <ProductImage
            src={images[index]}
            category={category}
            name={name}
            className="aspect-square w-full rounded-xl border border-border"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      <div className="flex gap-3 sm:flex-col">
        {mockViews.map((view, i) => (
          <button
            key={view}
            onClick={() => setActive(i)}
            aria-label={`Ver ${view}`}
            aria-pressed={active === i}
            className={cn(
              "size-16 shrink-0 overflow-hidden rounded-md border-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active === i ? "border-primary" : "border-border hover:border-primary/50",
            )}
          >
            <Thumb category={category} seed={`${name}-${view}`} className="size-full" />
          </button>
        ))}
      </div>

      <div className="relative flex-1">
        <Thumb
          category={category}
          seed={`${name}-${mockViews[active]}`}
          className="aspect-square w-full rounded-xl border border-border"
          iconClassName="h-1/4 w-1/4"
        />
      </div>
    </div>
  );
}
