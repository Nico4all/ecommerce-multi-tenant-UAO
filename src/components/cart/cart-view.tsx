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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
        <ShoppingBag className="size-12 text-muted-foreground/50" strokeWidth={1.25} />
        <h2 className="mt-4 font-heading text-xl font-semibold">
          Tu carrito está vacío
        </h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Explora las categorías y encuentra tus próximas ofertas.
        </p>
        <Link href="/" className={cn(buttonVariants(), "mt-5")}>
          Empezar a comprar
        </Link>
      </div>
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
                    className="size-24 rounded-lg border border-border"
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
                    <span className="mt-0.5 text-[11px] font-medium text-success">
                      Envío gratis
                    </span>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-md border border-border">
                      <button
                        onClick={() => setQty(l.id, l.qty - 1)}
                        disabled={l.qty <= 1 || busyItem !== null}
                        aria-label="Disminuir"
                        className="grid size-8 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm font-semibold tabular-nums">
                        {l.qty}
                      </span>
                      <button
                        onClick={() => setQty(l.id, l.qty + 1)}
                        disabled={busyItem !== null}
                        aria-label="Aumentar"
                        className="grid size-8 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
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
                        className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
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
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
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
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex h-10 flex-1 items-center rounded-md border border-border px-2">
                <Tag className="size-4 text-muted-foreground" />
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                  placeholder="Código de descuento"
                  className="h-full flex-1 bg-transparent px-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground"
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
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Subtotal ({cart.itemCount}{" "}
                {cart.itemCount === 1 ? "artículo" : "artículos"})
              </dt>
              <dd className="tabular-nums">{formatPrice(cart.subtotal)}</dd>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-primary">
                <dt>Descuento ({discount?.code})</dt>
                <dd className="tabular-nums">-{formatPrice(discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Envío</dt>
              <dd className="tabular-nums">
                {shipping === 0 ? (
                  <span className="font-medium text-success">Gratis</span>
                ) : (
                  formatPrice(shipping)
                )}
              </dd>
            </div>
          </dl>

          <Separator />

          <div className="flex items-baseline justify-between">
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
            <ShieldCheck className="size-3.5 text-success" />
            Pago 100% seguro y protegido
          </p>
        </div>
      </aside>
    </div>
  );
}
