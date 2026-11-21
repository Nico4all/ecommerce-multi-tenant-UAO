"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Tags,
  Percent,
  Ticket,
  Images,
  Home,
  CreditCard,
  Users,
  MessageSquare,
  HardDrive,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/products", label: "Productos", icon: Package },
  { href: "/admin/categories", label: "Categorías", icon: Tags },
  { href: "/admin/offers", label: "Ofertas", icon: Percent },
  { href: "/admin/discounts", label: "Descuentos", icon: Ticket },
  { href: "/admin/home", label: "Página de inicio", icon: Home },
  { href: "/admin/banners", label: "Imágenes del landing", icon: Images },
  { href: "/admin/payments", label: "Pagos", icon: CreditCard },
  { href: "/admin/mensajes", label: "Mensajes y PQR", icon: MessageSquare },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/almacenamiento", label: "Almacenamiento", icon: HardDrive },
];

export function AdminNav({
  onNavigate,
  /** Mensajes sin abrir; una PQR tiene plazo legal, así que se avisa aquí. */
  newSupportCount = 0,
}: {
  onNavigate?: () => void;
  newSupportCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del panel" className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        const badge = item.href === "/admin/mensajes" ? newSupportCount : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {/* La sección activa se marcaba solo con color. El remate rojo la
                distingue también para quien no separa esos dos tonos. */}
            {active && (
              <span
                aria-hidden
                className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-brand"
              />
            )}
            <item.icon aria-hidden className="size-4 shrink-0" />
            {item.label}
            {badge > 0 && (
              <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                {/* "3" a secas no dice de qué. */}
                <span className="sr-only">{badge} sin abrir</span>
                <span aria-hidden>{badge}</span>
              </span>
            )}
          </Link>
        );
      })}

      <Link
        href="/"
        onClick={onNavigate}
        className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Volver a la tienda
      </Link>
    </nav>
  );
}
