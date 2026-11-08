import type { Metadata } from "next";
import { getCart } from "@/lib/server/carts";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Carrito — Variedades Los Primos",
};

export default async function CartPage() {
  const cart = await getCart();

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      {/* Mismo remate rojo que encabeza el resto de la tienda. */}
      <h1 className="mb-6 flex items-center gap-3 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-brand" />
        Carrito de compras
      </h1>
      <CartView cart={cart} />
    </div>
  );
}
