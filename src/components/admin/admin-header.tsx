"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoImage } from "@/components/layout/logo";
import { AdminSearch } from "@/components/admin/admin-search";
import { NotificationBell } from "@/components/admin/notification-bell";
import type { NotificationFeed } from "@/lib/server/notifications";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AdminHeader({
  adminName = "Admin",
  newSupportCount = 0,
  notifications,
}: {
  adminName?: string;
  newSupportCount?: number;
  notifications: NotificationFeed;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
      {/* Menú móvil */}
      <Sheet>
        <SheetTrigger
          aria-label="Abrir menú"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden")}
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 overflow-hidden p-0">
          <SheetHeader className="h-14 shrink-0 flex-row items-center gap-2 border-b border-border">
            <LogoImage className="h-6" />
            <SheetTitle className="font-heading text-sm text-muted-foreground">
              Panel admin
            </SheetTitle>
          </SheetHeader>
          {/* Con 13 secciones el menú no cabía en pantallas cortas y no había
              forma de desplazar para ver las últimas. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <AdminNav newSupportCount={newSupportCount} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Buscador global */}
      <AdminSearch className="max-w-md flex-1" />

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationBell initial={notifications} />
        <Link
          href="/admin/perfil"
          aria-label="Mi perfil"
          className="ml-1 flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:bg-accent"
        >
          <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {adminName.slice(0, 2).toUpperCase()}
          </span>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
            {adminName.split(" ")[0]}
          </span>
        </Link>
      </div>
    </header>
  );
}
