"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Tag,
  ArrowRight,
  ShieldCheck,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProductImage } from "@/components/product/product-image";
import { EmptyState } from "@/components/catalog/product-grid";
import { formatPrice } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import { FREE_SHIPPING_THRESHOLD, shippingFor } from "@/lib/shipping";
import type { CartSummary } from "@/lib/server/carts";
import type { AppliedDiscount } from "@/lib/server/discounts";

/** Clave donde el carrito deja el cupón validado para que checkout lo retome. */
export const DISCOUNT_STORAGE_KEY = "vlp_discount";

export function CartView({ cart: initial }: { cart: CartSummary }) {
  const router = useRouter();
  const [cart, setCart] = React.useState<CartSummary>(initial);
  const [busyItem, setBusyItem] = React.useState<string | null>(null);
  const [couponCode, setCouponCode] = React.useState("");
  const [couponBusy, setCouponBusy] = React.useState(false);
  const [discount, setDiscount] = React.useState<AppliedDiscount | null>(null);

  const cartLines = cart.lines.map((l) => ({ shippingCost: l.product.shippingCost }));
  const shipping = discount?.freeShipping ? 0 : shippingFor(cart.subtotal, cartLines);
  const discountAmount = discount ? Math.min(discount.amount, cart.subtotal) : 0;
  const total = Math.max(0, cart.subtotal - discountAmount) + shipping;
  // El aviso de "te falta X para envío gratis" solo aplica cuando manda la
  // tarifa general: si algún producto trae costo propio, el umbral no cuenta.
  const usesStoreRate = cartLines.every(
    (l) => l.shippingCost === null || l.shippingCost === undefined,
  );
  const remainingForFree = usesStoreRate
    ? Math.max(0, FREE_SHIPPING_THRESHOLD - cart.subtotal)
    : 0;

  const mutate = async (fn: () => Promise<CartSummary>, itemId: string) => {
    setBusyItem(itemId);
    try {
      const updated = await fn();
      setCart(updated);
      router.refresh(); // contador del header
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo actualizar el carrito",
      );
    } finally {
      setBusyItem(null);
    }
  };

  const setQty = (itemId: string, qty: number) =>
    mutate(() => api.patch<CartSummary>(`/api/cart/items/${itemId}`, { qty }), itemId);

  const remove = (itemId: string) =>
    mutate(() => api.delete<CartSummary>(`/api/cart/items/${itemId}`), itemId);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponBusy(true);
    try {
      const applied = await api.post<AppliedDiscount>("/api/discounts/validate", {
        code: couponCode,
        subtotal: cart.subtotal,
      });
      setDiscount(applied);
      localStorage.setItem(DISCOUNT_STORAGE_KEY, applied.code);
      toast.success(`Código ${applied.code} aplicado`);
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo validar el código",
      );
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = () => {
    setDiscount(null);
    setCouponCode("");
    localStorage.removeItem(DISCOUNT_STORAGE_KEY);
  };

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Tu carrito está vacío"
        hint="Explora las categorías y encuentra tus próximas ofertas."
        action={
          <Link href="/" className={cn(buttonVariants())}>
            Empezar a comprar
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Líneas */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-border bg-card">
          {cart.lines.map((l, i) => (
            <div key={l.id}>
              {i > 0 && <Separator />}
              <div
                className={cn(
                  "flex gap-4 p-4 transition-opacity",
                  busyItem === l.id && "opacity-50",
                )}
              >
                <Link href={`/product/${l.product.slug}`} className="shrink-0">
                  <ProductImage
                    src={l.product.imageUrl}
                    category={l.product.category}
                    name={l.product.name}
                    className="size-20 rounded-lg border border-border sm:size-24"
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {l.product.brand}
                  </p>
                  <Link
                    href={`/product/${l.product.slug}`}
                    className="line-clamp-2 text-sm font-medium hover:text-primary"
                  >
                    {l.product.name}
                  </Link>
                  {l.variantName && (
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {l.variantColor && (
                        <span
                          aria-hidden
                          className="size-3 rounded-full ring-1 ring-border"
                          style={{ backgroundColor: l.variantColor }}
                        />
                      )}
                      Color: {l.variantName}
                    </span>
                  )}
                  {l.product.shippingCost === 0 && (
                    <span className="mt-0.5 text-[11px] font-medium text-success-ink">
                      Envío gratis
                    </span>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2">
                    {/* El nombre del grupo nombra el producto: con varias
                        lineas, "Disminuir" a secas no decia de cual. */}
                    <div
                      role="group"
                      aria-label={`Cantidad de ${l.product.name}`}
                      className="flex items-center rounded-md border border-border"
                    >
                      <button
                        onClick={() => setQty(l.id, l.qty - 1)}
                        disabled={l.qty <= 1 || busyItem !== null}
                        aria-label={`Disminuir cantidad de ${l.product.name}`}
                        className="grid size-8 place-items-center rounded-l-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span
                        aria-live="polite"
                        aria-atomic="true"
                        className="w-9 text-center text-sm font-semibold tabular-nums"
                      >
                        {l.qty}
                      </span>
                      <button
                        onClick={() => setQty(l.id, l.qty + 1)}
                        disabled={busyItem !== null}
                        aria-label={`Aumentar cantidad de ${l.product.name}`}
                        className="grid size-8 place-items-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-heading text-sm font-bold tabular-nums">
                        {formatPrice(l.product.price * l.qty)}
                      </span>
                      <button
                        onClick={() => remove(l.id)}
                        disabled={busyItem !== null}
                        aria-label={`Eliminar ${l.product.name}`}
                        className="rounded-sm text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Seguir comprando
        </Link>
      </div>

      {/* Resumen */}
      <aside className="lg:col-span-1">
        <div className="sticky top-40 space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Resumen del pedido</h2>

          {/* Cupón */}
          {discount ? (
            <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium text-primary">
                <Tag className="size-4" />
                {discount.code}
              </span>
              <button
                onClick={removeCoupon}
                aria-label="Quitar código"
                className="rounded-sm text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {/* El campo no tenía etiqueta (el marcador desaparece al
                  escribir y no lo anuncia el lector) ni anillo de foco. */}
              <label htmlFor="cupon" className="sr-only">
                Código de descuento
              </label>
              <div className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-border px-2 transition-shadow focus-within:ring-2 focus-within:ring-ring">
                <Tag aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <input
                  id="cupon"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                  placeholder="Código de descuento"
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground"
                />
              </div>
              <Button
                variant="outline"
                className="h-10"
                onClick={applyCoupon}
                disabled={couponBusy || !couponCode.trim()}
              >
                {couponBusy ? <Loader2 className="size-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          )}

          {remainingForFree > 0 && !discount?.freeShipping && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Te faltan{" "}
              <span className="font-semibold text-foreground">
                {formatPrice(remainingForFree)}
              </span>{" "}
              para obtener envío gratis.
            </p>
          )}

          <Separator />

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="min-w-0 text-muted-foreground">
                Subtotal ({cart.itemCount}{" "}
                {cart.itemCount === 1 ? "artículo" : "artículos"})
              </dt>
              <dd className="shrink-0 tabular-nums">{formatPrice(cart.subtotal)}</dd>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between gap-3 text-primary">
                <dt className="min-w-0 truncate">Descuento ({discount?.code})</dt>
                <dd className="shrink-0 tabular-nums">-{formatPrice(discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Envío</dt>
              <dd className="shrink-0 tabular-nums">
                {shipping === 0 ? (
                  <span className="font-medium text-success-ink">Gratis</span>
                ) : (
                  formatPrice(shipping)
                )}
              </dd>
            </div>
          </dl>

          <Separator />

          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">Total</span>
            <span className="font-heading text-xl font-bold tabular-nums">
              {formatPrice(total)}
            </span>
          </div>

          <Link
            href="/checkout"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 w-full gap-2 text-base",
            )}
          >
            Ir a pagar
            <ArrowRight className="size-5" />
          </Link>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden className="size-3.5 text-success-ink" />
            Pago 100% seguro y protegido
          </p>
        </div>
      </aside>
    </div>
  );
}
