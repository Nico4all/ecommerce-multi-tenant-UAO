"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  User,
  Package,
  Heart,
  LogOut,
  LayoutDashboard,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { CategoryVisual } from "@/components/category-visual";
import { LogoImage } from "@/components/layout/logo";
import { api } from "@/lib/api-client";
import type { HeaderUser } from "@/components/layout/user-menu";
import type { Category } from "@/types";

export function MobileNav({
  user,
  categories,
}: {
  user?: HeaderUser | null;
  categories: Category[];
}) {
  const router = useRouter();

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
      toast.success("Sesión cerrada");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("No se pudo cerrar la sesión");
    }
  };

  return (
    <Sheet>
      <SheetTrigger
        aria-label="Abrir menú"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "md:hidden",
        )}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-hidden p-0">
        <SheetHeader className="shrink-0 border-b border-border">
          {/* El logo real. Va como imagen y no como <Logo/>: el título del
              panel no debe ser un enlace, y ya hay uno al inicio en la cabecera. */}
          <SheetTitle>
            <LogoImage className="h-8" />
            <span className="sr-only">Variedades Los Primos</span>
          </SheetTitle>
        </SheetHeader>

        {/* Todo lo de abajo del encabezado desplaza en su propio scroll: el
            panel es de altura fija (h-full) y con 14+ categorías el contenido
            no cabía, quedando sin forma de bajar a verlas todas. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 p-3">
          {user ? (
            <div className="flex items-center gap-3 rounded-md bg-muted/60 px-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          ) : (
            <SheetClose
              nativeButton={false}
              render={
                <Link
                  href="/login"
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                />
              }
            >
              <User className="size-4 text-primary" /> Iniciar sesión
            </SheetClose>
          )}
          {/* Solo con sesión: sin ella /cuenta rebota al login. */}
          {user && (
            <SheetClose
              nativeButton={false}
              render={
                <Link
                  href="/cuenta"
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                />
              }
            >
              <UserCog className="size-4 text-primary" /> Mi cuenta
            </SheetClose>
          )}
          <SheetClose
            nativeButton={false}
            render={
              <Link
                href="/orders"
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
              />
            }
          >
            <Package className="size-4 text-primary" /> Mis pedidos
          </SheetClose>
          <SheetClose
            nativeButton={false}
            render={
              <Link
                href="/wishlist"
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
              />
            }
          >
            <Heart className="size-4 text-primary" /> Favoritos
          </SheetClose>
          {/* Mismo criterio que el menú de escritorio: solo para ADMIN. */}
          {user?.role === "ADMIN" && (
            <SheetClose
              nativeButton={false}
              render={
                <Link
                  href="/admin"
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-primary hover:bg-accent"
                />
              }
            >
              <LayoutDashboard className="size-4" /> Panel admin
            </SheetClose>
          )}
          {user && (
            <SheetClose
              onClick={logout}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" /> Cerrar sesión
            </SheetClose>
          )}
        </div>

        <div className="px-3 pb-6">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categorías
          </p>
          <div className="flex flex-col gap-1">
            {categories.map((c) => (
              <SheetClose
                key={c.slug}
                nativeButton={false}
                render={
                  <Link
                    href={`/category/${c.slug}`}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent"
                  />
                }
              >
                <CategoryVisual
                  category={c}
                  className="size-5 rounded-md text-muted-foreground"
                  iconClassName="size-4"
                />
                {c.name}
              </SheetClose>
            ))}
          </div>
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
