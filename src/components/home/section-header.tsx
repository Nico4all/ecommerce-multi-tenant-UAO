import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Encabezado de sección del inicio.
 *
 * La regla roja a la izquierda del título es el recurso estructural que repite
 * la composición del manual: el rojo entra como elemento gráfico, donde le
 * basta 3:1 (WCAG 1.4.11), y el texto se queda en los tonos que sí llegan a
 * 4.5:1. Así el rojo "está siempre presente" sin cargarlo de texto pequeño.
 *
 * `href` es opcional: sin destino no se pinta "Ver todo", en vez de dejar un
 * enlace a "#", que para un lector de pantalla es un enlace roto.
 */
export function SectionHeader({
  title,
  href,
  /** La sección tiene fondo de color o imagen: el texto va en crema. */
  onDark = false,
}: {
  title: string;
  href?: string;
  onDark?: boolean;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "h-6 w-1 shrink-0 rounded-full sm:h-7",
            onDark ? "bg-media" : "bg-brand",
          )}
        />
        <h2
          className={cn(
            "min-w-0 font-heading text-xl font-bold tracking-tight sm:text-2xl",
            onDark && "text-media drop-shadow-sm",
          )}
        >
          {title}
        </h2>
      </div>

      {href && (
        <Link
          href={href}
          className={cn(
            "flex shrink-0 items-center gap-0.5 rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-current",
            onDark ? "text-media" : "text-primary",
          )}
        >
          Ver todo
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
