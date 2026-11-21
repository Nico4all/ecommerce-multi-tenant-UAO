import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <li>
          <Link
            href="/"
            aria-label="Inicio"
            className="flex rounded-sm p-0.5 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Home className="size-4" />
          </Link>
        </li>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              <ChevronRight className="size-4 text-muted-foreground/50" aria-hidden />
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded-sm underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                /* El último es la página actual: se marca para que un lector
                   de pantalla no lo anuncie como un destino más al que ir. */
                <span
                  aria-current={last ? "page" : undefined}
                  className="font-medium text-foreground"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
