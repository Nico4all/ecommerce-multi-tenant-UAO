import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/catalog/product-grid";
import { getCart } from "@/lib/server/carts";
import { getSession } from "@/lib/server/auth";
import { getProfile } from "@/lib/server/account";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Finalizar compra — ${SITE_NAME}`,
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
      {/* Mismo remate rojo que encabeza el resto de la tienda. */}
      <h1 className="mb-6 flex items-center gap-3 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-brand" />
        Finalizar compra
      </h1>
      {cart.lines.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No hay nada que pagar todavía"
          hint="Agrega productos al carrito y vuelve aquí para completar tu compra."
          action={
            <Link href="/" className={cn(buttonVariants())}>
              Ir a la tienda
            </Link>
          }
        />
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
