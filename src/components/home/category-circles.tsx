"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryVisual } from "@/components/category-visual";
import { SectionHeader } from "@/components/home/section-header";
import type { Category } from "@/types";

export function CategoryCircles({ categories }: { categories: Category[] }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = React.useState(false);
  const [canRight, setCanRight] = React.useState(false);

  const update = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    update();
    const el = scrollRef.current;
    el?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update, categories.length]);

  const scrollBy = (dir: 1 | -1) =>
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <section>
      <SectionHeader title="Explora categorías populares" href="/categories" />

      <div className="relative">
        {/* Flecha izquierda */}
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Ver categorías anteriores"
          className={cn(
            "absolute -left-3 top-7 z-10 hidden size-9 place-items-center rounded-full border border-border bg-background text-foreground shadow-md transition-opacity hover:bg-accent md:grid",
            canLeft ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <ChevronLeft className="size-5" />
        </button>

        {/* Carrusel deslizable (rueda/touch) con scroll-snap */}
        <div
          ref={scrollRef}
          className="no-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth pb-2 sm:gap-6"
        >
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="group flex w-20 shrink-0 snap-start flex-col items-center gap-2"
            >
              <CategoryVisual
                category={c}
                className="size-20 rounded-full ring-1 ring-border transition-transform group-hover:scale-105"
                iconClassName="size-8"
              />
              <span className="line-clamp-2 text-center text-xs font-medium text-foreground">
                {c.name}
              </span>
            </Link>
          ))}
        </div>

        {/* Flecha derecha */}
        <button
          onClick={() => scrollBy(1)}
          aria-label="Ver más categorías"
          className={cn(
            "absolute -right-3 top-7 z-10 hidden size-9 place-items-center rounded-full border border-border bg-background text-foreground shadow-md transition-opacity hover:bg-accent md:grid",
            canRight ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </section>
  );
}
