"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, X, ShoppingCart, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProductImage } from "@/components/product/product-image";
import { RatingStars } from "@/components/product/rating-stars";
import { PriceTag } from "@/components/product/price-tag";
import { EmptyState } from "@/components/catalog/product-grid";
import { api, ApiClientError } from "@/lib/api-client";
import type { Product } from "@/types";

export function WishlistView({ initial }: { initial: Product[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState<Product[]>(initial);
  const [added, setAdded] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  // Los avisos de "Agregado" se apagan solos a los 1,8 s. Si el cliente se va
  // de la pagina antes, el temporizador seguia vivo e intentaba tocar estado
  // de un componente ya desmontado.
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  React.useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const remove = async (p: Product) => {
    setBusy(p.id);
    try {
      await api.delete(`/api/wishlist/${p.id}`);
      setItems((xs) => xs.filter((x) => x.id !== p.id));
      toast.success("Quitado de favoritos");
    } catch {
      toast.error("No se pudo quitar de favoritos");
    } finally {
      setBusy(null);
    }
  };

  const addToCart = async (p: Product) => {
    setBusy(p.id);
    try {
      await api.post("/api/cart/items", { productId: p.id, qty: 1 });
      setAdded((a) => ({ ...a, [p.id]: true }));
      timers.current.push(
        setTimeout(() => setAdded((a) => ({ ...a, [p.id]: false })), 1800),
      );
      toast.success("Agregado al carrito");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo agregar al carrito",
      );
    } finally {
      setBusy(null);
    }
  };

  const addAll = async () => {
    setBusy("all");
    let ok = 0;
    for (const p of items) {
      try {
        await api.post("/api/cart/items", { productId: p.id, qty: 1 });
        ok++;
      } catch {
        // productos sin stock se omiten
      }
    }
    setBusy(null);
    if (ok > 0) {
      toast.success(`${ok} ${ok === 1 ? "producto agregado" : "productos agregados"} al carrito`);
      router.refresh();
    } else {
      toast.error("No se pudo agregar ningún producto");
    }
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Tu lista de favoritos está vacía"
        hint="Guarda productos con el corazón para encontrarlos aquí más tarde."
        action={
          <Link href="/" className={cn(buttonVariants())}>
            Descubrir productos
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {items.length}
          </span>{" "}
          {items.length === 1 ? "producto guardado" : "productos guardados"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={addAll}
          disabled={busy !== null}
        >
          {busy === "all" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShoppingCart className="size-4" />
          )}
          Agregar todo al carrito
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <div
            key={p.id}
            className={cn(
              "group relative flex flex-col rounded-lg border border-border bg-card p-3 transition-opacity",
              busy === p.id && "opacity-60",
            )}
          >
            <button
              onClick={() => remove(p)}
              disabled={busy !== null}
              aria-label={`Quitar ${p.name} de favoritos`}
              className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full bg-background/80 text-muted-foreground outline-none backdrop-blur transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" />
            </button>

            <Link href={`/product/${p.slug}`}>
              <ProductImage
                src={p.imageUrl}
                category={p.category}
                name={p.name}
                className="aspect-square w-full rounded-md"
              />
            </Link>

            <div className="mt-3 flex flex-1 flex-col gap-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {p.brand}
              </p>
              <Link
                href={`/product/${p.slug}`}
                className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary"
              >
                {p.name}
              </Link>
              <RatingStars rating={p.rating} reviews={p.reviews} className="mt-0.5" />
              <div className="mt-auto pt-1.5">
                <PriceTag price={p.price} oldPrice={p.oldPrice} />
              </div>
            </div>

            <Button
              size="sm"
              variant={added[p.id] ? "secondary" : "default"}
              className="mt-3 w-full gap-1.5"
              onClick={() => addToCart(p)}
              disabled={busy !== null}
            >
              {added[p.id] ? (
                <>
                  <Check className="size-4" /> Agregado
                </>
              ) : (
                <>
                  <ShoppingCart className="size-4" /> Agregar
                </>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
