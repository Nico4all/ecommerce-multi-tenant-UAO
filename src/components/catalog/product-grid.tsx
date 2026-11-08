import { PackageOpen } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/types";

/**
 * Rejilla de resultados.
 *
 * Cuando no hay nada que mostrar, el motivo lo sabe quien llama: no es lo
 * mismo que la categoría esté vacía que que los filtros hayan descartado todo.
 * Por eso el vacío entra como `empty` en vez de resolverse aquí con un texto
 * único que servía para todo y no ayudaba en ningún caso.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <PackageOpen
        className="size-10 text-muted-foreground/60"
        strokeWidth={1.25}
        aria-hidden
      />
      <p className="mt-3 font-heading text-lg font-semibold">{title}</p>
      {hint && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProductGrid({
  products,
  empty,
}: {
  products: Product[];
  empty?: React.ReactNode;
}) {
  if (products.length === 0) {
    return (
      empty ?? (
        <EmptyState
          title="No encontramos productos"
          hint="Prueba a quitar algunos filtros o busca con otras palabras."
        />
      )
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
