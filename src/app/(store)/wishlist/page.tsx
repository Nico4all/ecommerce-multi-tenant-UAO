import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { getWishlist } from "@/lib/server/wishlist";
import { WishlistView } from "@/components/wishlist/wishlist-view";

export const metadata: Metadata = {
  title: "Favoritos — Variedades Los Primos",
};

export default async function WishlistPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/wishlist");

  const products = await getWishlist();

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <h1 className="flex items-center gap-3 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-brand" />
        Mis favoritos
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Los productos que has guardado para más tarde.
      </p>
      <WishlistView initial={products} />
    </div>
  );
}
