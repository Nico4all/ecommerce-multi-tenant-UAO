import Link from "next/link";
import { ShoppingCart, Heart } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { SearchBar } from "@/components/layout/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu, LoginLink } from "@/components/layout/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/server/auth";
import { getCartCount } from "@/lib/server/carts";
import type { Category } from "@/types";

export async function Header({ categories }: { categories: Category[] }) {
  const [session, cartCount] = await Promise.all([
    getSession(),
    getCartCount().catch(() => 0),
  ]);

  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4">
        <MobileNav user={session} categories={categories} />
        <Logo />

        <div className="mx-2 hidden flex-1 md:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />

          <Link
            href="/wishlist"
            aria-label="Favoritos"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "hidden sm:inline-flex",
            )}
          >
            <Heart className="size-5" />
          </Link>

          {/* Cuenta */}
          {session ? <UserMenu user={session} /> : <LoginLink />}

          {/* Carrito */}
          <Link
            href="/cart"
            aria-label={`Carrito, ${cartCount} artículos`}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "relative h-10 gap-2 px-2",
            )}
          >
            <span className="relative">
              <ShoppingCart className="size-5" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 grid size-4 min-w-4 place-items-center rounded-full bg-deal px-1 text-[10px] font-bold text-deal-foreground tabular-nums">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </span>
            <span className="hidden text-sm font-medium lg:inline">Carrito</span>
          </Link>
        </div>
      </div>

      {/* Buscador en móvil */}
      <div className="px-4 pb-3 md:hidden">
        <SearchBar />
      </div>
    </div>
  );
}
