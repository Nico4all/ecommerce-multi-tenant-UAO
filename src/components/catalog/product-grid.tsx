import { PackageOpen } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/types";

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
        <PackageOpen className="size-10 text-muted-foreground/60" strokeWidth={1.25} />
        <p className="mt-3 font-heading text-lg font-semibold">
          No encontramos productos
        </p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Prueba a quitar algunos filtros o busca con otras palabras.
        </p>
      </div>
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
