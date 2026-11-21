import { cn } from "@/lib/utils";
import { Thumb } from "@/components/product/thumb";
import type { CategorySlug } from "@/types";

/**
 * Foto de un producto, con respaldo.
 *
 * Si el producto no tiene imagen propia se cae al mosaico de la categoría, que
 * es lo que la tienda ha mostrado siempre. La foto va en `object-contain`: una
 * foto de producto no se recorta nunca, aunque no cuadre con el hueco.
 */
export function ProductImage({
  src,
  category,
  name,
  className,
  iconClassName,
}: {
  src?: string | null;
  category: CategorySlug;
  name: string;
  className?: string;
  iconClassName?: string;
}) {
  if (!src) {
    return (
      <Thumb
        category={category}
        seed={name}
        className={className}
        iconClassName={iconClassName}
      />
    );
  }

  return (
    <div className={cn("overflow-hidden bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ruta subida o URL externa del admin */}
      <img
        src={src}
        alt={name}
        loading="lazy"
        className="size-full object-contain"
      />
    </div>
  );
}
