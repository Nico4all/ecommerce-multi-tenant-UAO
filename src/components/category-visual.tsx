import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/category-icon";

interface CategoryLike {
  name: string;
  icon: string;
  gradient: string;
  imageUrl?: string | null;
}

/**
 * Visual de una categoría: usa su imagen/SVG propia si existe; si no,
 * el tile de gradiente con icono Lucide. Las clases de forma/tamaño
 * (size-*, rounded-*, ring-*) las pone el llamador.
 */
export function CategoryVisual({
  category,
  className,
  iconClassName,
}: {
  category: CategoryLike;
  className?: string;
  iconClassName?: string;
}) {
  if (category.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa definida por el admin
      <img
        src={category.imageUrl}
        alt={category.name}
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-gradient-to-br",
        category.gradient,
        className,
      )}
    >
      <CategoryIcon
        name={category.icon}
        className={iconClassName}
        strokeWidth={1.5}
      />
    </span>
  );
}
