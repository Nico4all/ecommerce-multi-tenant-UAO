import Link from "next/link";
import { CityPicker } from "@/components/layout/city-picker";

export function TopBar() {
  return (
    <div className="hidden border-b border-border bg-muted/50 text-xs text-muted-foreground md:block">
      <div className="mx-auto flex h-9 max-w-[1280px] items-center justify-between px-4">
        <CityPicker />
        <nav className="flex items-center gap-5">
          <Link href="/ayuda" className="hover:text-foreground">
            Ayuda
          </Link>
          <Link href="/pqr" className="hover:text-foreground">
            PQR
          </Link>
          <Link href="/contacto" className="hover:text-foreground">
            Contáctanos
          </Link>
          {/* Los precios se cobran siempre en pesos colombianos: es un dato, no
              un selector, porque no hay conversión de moneda. */}
          <span>Español (COP)</span>
        </nav>
      </div>
    </div>
  );
}
