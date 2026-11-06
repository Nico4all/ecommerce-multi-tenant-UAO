"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, Package, Heart, LayoutDashboard, Settings } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";

export interface HeaderUser {
  name: string;
  email: string;
  role: "ADMIN" | "CUSTOMER";
}

export function UserMenu({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const firstName = user.name.split(" ")[0];

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
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "hidden h-10 gap-2 px-2 sm:inline-flex",
        )}
      >
        <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {firstName.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden text-left text-xs leading-tight lg:block">
          <span className="block text-muted-foreground">Hola,</span>
          <span className="block max-w-24 truncate font-semibold">{firstName}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Base UI exige que GroupLabel viva dentro de un Group */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block">{user.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/cuenta" />}>
          <Settings className="size-4" /> Mi cuenta
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/orders" />}>
          <Package className="size-4" /> Mis pedidos
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/wishlist" />}>
          <Heart className="size-4" /> Favoritos
        </DropdownMenuItem>
        {user.role === "ADMIN" && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <LayoutDashboard className="size-4" /> Panel admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive">
          <LogOut className="size-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Enlace a /login cuando no hay sesión (mismo look del diseño original). */
export function LoginLink() {
  return (
    <Link
      href="/login"
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "hidden h-10 gap-2 px-2 sm:inline-flex",
      )}
    >
      <User className="size-5" />
      <span className="hidden text-left text-xs leading-tight lg:block">
        <span className="block text-muted-foreground">Hola,</span>
        <span className="block font-semibold">Inicia sesión</span>
      </span>
    </Link>
  );
}
