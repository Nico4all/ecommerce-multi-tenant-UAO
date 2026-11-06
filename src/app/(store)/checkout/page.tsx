import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getCart } from "@/lib/server/carts";
import { getSession } from "@/lib/server/auth";
import { getProfile } from "@/lib/server/account";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = {
  title: "Finalizar compra — Variedades Los Primos",
};

export default async function CheckoutPage() {
  const [cart, session] = await Promise.all([getCart(), getSession()]);

  // Comprar exige cuenta (si no, el cliente no puede ver sus pedidos). El
  // carrito de invitado se conserva: se fusiona al iniciar sesión.
  if (!session) redirect("/login?next=/checkout");

  // Datos guardados de la cuenta para precargar el formulario (teléfono y
  // dirección por defecto). Si el cliente los cambia, es su decisión.
  const profile = await getProfile(session.id);
  const addr = profile?.address ?? null;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <h1 className="mb-6 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Finalizar compra
      </h1>
      {cart.lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <ShoppingBag className="size-12 text-muted-foreground/50" strokeWidth={1.25} />
          <h2 className="mt-4 font-heading text-xl font-semibold">
            No hay nada que pagar todavía
          </h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Agrega productos al carrito y vuelve aquí para completar tu compra.
          </p>
          <Link href="/" className={cn(buttonVariants(), "mt-5")}>
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <CheckoutForm
          cart={cart}
          defaults={{
            name: profile?.name ?? session.name,
            email: profile?.email ?? session.email,
            phone: profile?.phone ?? "",
            street: addr?.street ?? "",
            city: addr?.city ?? "",
            state: addr?.state ?? "",
            zip: addr?.zip ?? "",
            country: addr?.country ?? "Colombia",
          }}
        />
      )}
    </div>
  );
}
