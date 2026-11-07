"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/product/product-image";
import { formatPrice } from "@/lib/format";
import { api } from "@/lib/api-client";
import type { CategorySlug } from "@/types";

interface Suggest {
  products: {
    slug: string;
    name: string;
    price: number;
    imageUrl: string | null;
    category: string;
  }[];
  categories: { slug: string; name: string }[];
}

const EMPTY: Suggest = { products: [], categories: [] };

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Suggest>(EMPTY);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Trae sugerencias con debounce mientras el cliente escribe.
  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const data = await api.get<Suggest>(
          `/api/search/suggest?q=${encodeURIComponent(term)}`,
        );
        setResults(data);
      } catch {
        setResults(EMPTY);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  // Cierra el desplegable al hacer clic fuera.
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) go(`/search?q=${encodeURIComponent(term)}`);
  };

  const hasResults = results.products.length > 0 || results.categories.length > 0;
  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={onSubmit}
        className="flex h-11 w-full items-center overflow-hidden rounded-full border border-border bg-background shadow-sm transition-shadow focus-within:border-brand focus-within:ring-2 focus-within:ring-ring/60"
      >
        <label htmlFor="site-search" className="sr-only">
          Buscar productos
        </label>
        <input
          id="site-search"
          name="q"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Buscar productos, marcas y categorías…"
          className="h-full flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
        />
        {/* Única superficie de la cabecera en rojo dominante. Puede serlo
            porque sólo lleva icono: a 1.4.11 le basta 3:1 y el blanco sobre
            #FF051E da 3.97:1. Con texto pequeño encima no sería admisible. */}
        <button
          type="submit"
          aria-label="Buscar"
          className="grid h-full w-12 shrink-0 place-items-center bg-brand text-brand-foreground transition-colors hover:bg-brand/90"
        >
          <Search className="size-5" />
        </button>
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
          {loading && !hasResults ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Buscando…
            </div>
          ) : hasResults ? (
            <div className="max-h-[70vh] overflow-y-auto py-1">
              {results.categories.map((c) => (
                <button
                  key={`c-${c.slug}`}
                  type="button"
                  onClick={() => go(`/category/${c.slug}`)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Tag className="size-4" />
                  </span>
                  <span>
                    Categoría: <span className="font-medium">{c.name}</span>
                  </span>
                </button>
              ))}

              {results.products.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => go(`/product/${p.slug}`)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
                >
                  <ProductImage
                    src={p.imageUrl}
                    category={p.category as CategorySlug}
                    name={p.name}
                    className="size-10 shrink-0 rounded-md border border-border"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatPrice(p.price)}
                    </span>
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}
                className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
              >
                <Search className="size-4" />
                Ver todos los resultados para &ldquo;{q.trim()}&rdquo;
              </button>
            </div>
          ) : (
            <div className="px-4 py-4 text-sm text-muted-foreground">
              Sin coincidencias para &ldquo;{q.trim()}&rdquo;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
