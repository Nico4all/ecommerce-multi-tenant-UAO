"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Flame, ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryVisual } from "@/components/category-visual";
import type { Category } from "@/types";

/**
 * Barra de categorías del inicio.
 *
 * "Todas las categorías" abre un panel con TODAS, así no hace falta arrastrar la
 * barra para encontrar una. Se abre al pasar el cursor, pero también con clic y
 * con teclado: dejarlo solo en hover lo haría inservible en móvil y con lector
 * de pantalla.
 *
 * La tira horizontal sigue pudiendo desplazarse: es el atajo a las primeras
 * categorías y en móvil es el patrón normal.
 */
export function CategoryNav({ categories }: { categories: Category[] }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            openOnHover
            delay={80}
            closeDelay={120}
            className="group flex shrink-0 items-center gap-2 py-3 pr-3 text-sm font-semibold text-foreground outline-none hover:text-primary focus-visible:text-primary data-popup-open:text-primary"
          >
            <Menu className="size-4" />
            Todas las categorías
            <ChevronDown className="size-3.5 transition-transform group-data-popup-open:rotate-180" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            sideOffset={0}
            className="w-[min(92vw,34rem)] p-2"
          >
            <ul className="grid gap-0.5 sm:grid-cols-2">
              {categories.map((c) => {
                const href = `/category/${c.slug}`;
                const active = pathname === href;
                return (
                  <li key={c.slug}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent",
                        active && "bg-primary/10 font-medium text-primary",
                      )}
                    >
                      <CategoryVisual
                        category={c}
                        className="size-8 rounded-full ring-1 ring-border"
                        iconClassName="size-4"
                      />
                      <span className="min-w-0 truncate">{c.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <Link
              href="/categories"
              className="mt-1 flex items-center justify-between gap-2 rounded-md border-t border-border px-2 pb-1 pt-2.5 text-sm font-medium text-primary hover:underline"
            >
              Ver todas las categorías
              <ArrowRight className="size-4" />
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>

        <nav
          aria-label="Categorías destacadas"
          className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto"
        >
          {categories.map((c) => {
            const href = `/category/${c.slug}`;
            const active = pathname === href;
            return (
              <Link
                key={c.slug}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // El subrayado activo es el rojo dominante: ahí es un
                  // elemento gráfico, así que le basta con 3:1. La etiqueta en
                  // cambio va en el subordinado, que sí llega a 4.5:1.
                  "whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors",
                  active
                    ? "border-brand font-semibold text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>

        {/* Antes era texto en el color de ofertas, que sobre fondo claro se
            queda en 2.2:1. Como chip relleno, la tinta oscura sobre el naranja
            llega a 8.6:1 y además destaca más. */}
        <Link
          href="/deals"
          className={cn(
            "ml-auto hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors sm:flex",
            pathname === "/deals"
              ? "bg-deal text-deal-foreground"
              : "bg-deal/15 text-foreground hover:bg-deal hover:text-deal-foreground",
          )}
        >
          <Flame className="size-4" />
          Mejores ofertas
        </Link>
      </div>
    </div>
  );
}
