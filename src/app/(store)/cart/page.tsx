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
      <h1 className="mb-6 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Carrito de compras
      </h1>
      <CartView cart={cart} />
    </div>
  );
}
