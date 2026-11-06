import { cn } from "@/lib/utils";
import { categoryBySlug } from "@/data/categories";
import { CategoryIcon } from "@/components/category-icon";

/**
 * Placeholder de un producto sin foto: mosaico con el degradado de su categoría
 * y un icono.
 *
 * Las categorías originales tienen su degradado curado en `categoryBySlug`. Para
 * las que cree el dueño desde el panel (que no están en ese mapa) se deriva un
 * degradado estable a partir del slug: siempre el mismo color para la misma
 * categoría, en vez del recuadro gris que salía antes.
 */

/** Paleta de respaldo. El slug elige una de forma determinista. */
const FALLBACK_GRADIENTS = [
  "from-emerald-500/25 to-teal-600/25",
  "from-sky-500/25 to-indigo-600/25",
  "from-amber-500/25 to-orange-600/25",
  "from-rose-500/25 to-pink-600/25",
  "from-violet-500/25 to-purple-600/25",
  "from-lime-500/25 to-green-600/25",
  "from-cyan-500/25 to-blue-600/25",
  "from-fuchsia-500/25 to-rose-600/25",
];

function gradientFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length];
}

export function Thumb({
  category,
  seed,
  className,
  iconClassName,
}: {
  /** Slug de la categoría; puede ser cualquiera creada desde el panel. */
  category: string;
  seed: string;
  className?: string;
  iconClassName?: string;
}) {
  const cat = categoryBySlug[category as keyof typeof categoryBySlug];
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br",
        cat?.gradient ?? gradientFor(category),
        className,
      )}
      aria-hidden
    >
      <CategoryIcon
        name={cat?.icon ?? "package"}
        strokeWidth={1.25}
        className={cn("h-1/3 w-1/3 opacity-70", iconClassName)}
      />
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,white,transparent_60%)] opacity-40 dark:opacity-10" />
      <span className="sr-only">{seed}</span>
    </div>
  );
}
