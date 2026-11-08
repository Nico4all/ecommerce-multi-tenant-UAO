"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Check, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api-client";
import type { ProductVariantItem } from "@/lib/server/catalog";

export function PurchasePanel({
  slug,
  stock,
  variants = [],
}: {
  slug: string;
  stock: number;
  variants?: ProductVariantItem[];
}) {
  const router = useRouter();
  // Arranca en la primera variante con existencias: si la primera estaba
  // agotada, el producto entero se leia como sin stock aunque los demas
  // colores si lo tuvieran. Sin ninguna disponible se queda en la primera.
  const [variantIdx, setVariantIdx] = React.useState(() =>
    Math.max(0, variants.findIndex((v) => v.stock > 0)),
  );
  const [qty, setQty] = React.useState(1);
  const [added, setAdded] = React.useState(false);
  const [loading, setLoading] = React.useState<"add" | "buy" | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const selectedVariant = variants[variantIdx];
  // Sin respaldo inventado: `stock` es una columna real y el servidor valida
  // contra ella. El 99 que habia aqui mostraba "99 disponibles" y dejaba
  // comprar un producto con cero existencias, hasta que fallaba al agregar.
  const maxStock = selectedVariant ? selectedVariant.stock : stock;
  const outOfStock = maxStock <= 0;

  const addToCart = async (mode: "add" | "buy") => {
    setLoading(mode);
    try {
      await api.post("/api/cart/items", {
        slug,
        qty,
        variantId: selectedVariant?.id,
      });
      if (mode === "buy") {
        router.push("/checkout");
        router.refresh();
        return;
      }
      setAdded(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAdded(false), 2000);
      toast.success("Agregado al carrito");
      router.refresh(); // actualiza el contador del header
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo agregar al carrito",
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Variantes reales (si el producto las tiene) */}
      {variants.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">
            Color:{" "}
            <span className="text-muted-foreground">{selectedVariant?.name}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v, i) => (
              <button
                key={v.id}
                onClick={() => {
                  setVariantIdx(i);
                  setQty(1);
                }}
                disabled={v.stock <= 0}
                aria-pressed={variantIdx === i}
                title={v.stock <= 0 ? `${v.name} (agotado)` : v.name}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  variantIdx === i
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    : "border-border hover:bg-accent",
                  v.stock <= 0 && "opacity-40",
                )}
              >
                {v.colorHex && (
                  <span
                    aria-hidden
                    className="size-4 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: v.colorHex }}
                  />
                )}
                {v.name}
                {/* El title no lo lee un lector de pantalla de forma fiable;
                    asi el estado agotado viaja en el nombre del control. */}
                {v.stock <= 0 && <span className="sr-only"> (agotado)</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cantidad */}
      <div>
        <p className="mb-2 text-sm font-medium">Cantidad</p>
        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Cantidad"
            className="flex items-center rounded-md border border-border"
          >
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Disminuir cantidad"
              className="grid size-9 place-items-center rounded-l-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            {/* Se anuncia al pulsar + o -: antes el numero cambiaba en
                silencio y no habia forma de confirmarlo sin ver la pantalla. */}
            <span
              aria-live="polite"
              aria-atomic="true"
              className="w-10 text-center text-sm font-semibold tabular-nums"
            >
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(maxStock, q + 1))}
              disabled={qty >= maxStock}
              aria-label="Aumentar cantidad"
              className="grid size-9 place-items-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {outOfStock ? (
              <span className="font-medium text-destructive">Agotado</span>
            ) : (
              `${maxStock} disponibles`
            )}
          </span>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          size="lg"
          className="h-11 gap-2 text-base"
          onClick={() => addToCart("add")}
          disabled={outOfStock || loading !== null}
          aria-live="polite"
        >
          {loading === "add" ? (
            <>
              <Loader2 className="size-5 animate-spin" /> Agregando…
            </>
          ) : added ? (
            <>
              <Check className="size-5" /> Agregado al carrito
            </>
          ) : (
            <>
              <ShoppingCart className="size-5" /> Agregar al carrito
            </>
          )}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-11 gap-2 border-deal-ink text-base text-deal-ink hover:border-deal hover:bg-deal hover:text-deal-foreground"
          onClick={() => addToCart("buy")}
          disabled={outOfStock || loading !== null}
        >
          {loading === "buy" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Zap className="size-5" />
          )}
          Comprar ahora
        </Button>
      </div>
    </div>
  );
}
