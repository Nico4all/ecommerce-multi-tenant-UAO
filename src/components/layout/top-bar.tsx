import Link from "next/link";
import { CityPicker } from "@/components/layout/city-picker";

/**
 * Barra de servicio sobre la cabecera.
 *
 * Va sobre el color subordinado de la marca (#AC0B32 en claro) y no sobre el
 * rojo dominante: a 12px, el texto blanco sobre el rojo se queda en 3.97:1 y no
 * llega al 4.5:1 que pide WCAG para texto pequeño. El rojo dominante aparece
 * justo encima, en la franja de `SiteHeader`, donde es decorativo.
 */

const LINKS = [
  { href: "/ayuda", label: "Ayuda" },
  { href: "/pqr", label: "PQR" },
  { href: "/contacto", label: "Contáctanos" },
];

export function TopBar() {
  return (
    <div className="hidden bg-primary text-xs text-primary-foreground md:block">
      <div className="mx-auto flex h-9 max-w-[1280px] items-center justify-between gap-4 px-4">
        <CityPicker />
        <nav aria-label="Atención al cliente" className="flex items-center gap-5">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-foreground"
            >
              {link.label}
            </Link>
          ))}
          {/* Los precios se cobran siempre en pesos colombianos: es un dato, no
              un selector, porque no hay conversión de moneda. */}
          <span className="text-primary-foreground/85">Español (COP)</span>
        </nav>
      </div>
    </div>
  );
}
