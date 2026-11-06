import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Banner } from "@/types";

/**
 * Tarjeta de banner del inicio.
 *
 * - `size` ajusta la densidad del texto (sm se usa cuando hay varios apilados).
 * - Si el banner tiene `imageUrl`, la imagen es el fondo; si no, se usa su gradiente.
 * - Texto y botón son opcionales: un banner puede ser solo la imagen. La tarjeta
 *   entera es el enlace, así que sin botón el clic sigue llevando al destino.
 */
export function BannerCard({
  banner,
  className,
  size = "md",
}: {
  banner: Banner;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const hasImage = !!banner.imageUrl;
  const hasText = !!(banner.title || banner.subtitle || banner.highlight);

  return (
    <Link
      href={banner.href}
      // El título es el nombre accesible; sin texto, lo da el destino del enlace.
      aria-label={hasText ? undefined : `Ver ${banner.href}`}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl shadow-sm transition-shadow hover:shadow-md",
        size === "sm" ? "p-4" : "p-5 sm:p-6",
        hasImage ? "bg-slate-900 text-white" : banner.className,
        className,
      )}
    >
      {hasImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- ruta subida o URL externa del admin */}
          <img
            src={banner.imageUrl as string}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* El velo solo va si hay algo que leer encima: en un banner que es
              solo imagen, oscurecerla sería estropear la gráfica del diseñador. */}
          {(hasText || banner.cta) && (
            <span className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          )}
        </>
      ) : (
        /* Brillo decorativo */
        <span className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
      )}

      {hasText && (
        <div className="relative min-w-0">
          {banner.highlight && (
            <span
              className={cn(
                "inline-block font-heading font-extrabold leading-none drop-shadow-sm",
                size === "lg" && "text-3xl sm:text-4xl lg:text-5xl",
                size === "md" && "text-2xl sm:text-3xl",
                size === "sm" && "text-xl",
              )}
            >
              {banner.highlight}
            </span>
          )}
          {banner.title && (
            <h3
              className={cn(
                "mt-1 font-heading font-bold leading-tight",
                size === "lg" && "text-xl sm:text-2xl lg:text-3xl",
                size === "md" && "text-lg",
                size === "sm" && "line-clamp-1 text-base",
              )}
            >
              {banner.title}
            </h3>
          )}
          {banner.subtitle && (
            <p
              className={cn(
                "mt-1 max-w-[30ch] text-white/90",
                size === "lg" && "text-base",
                size === "md" && "text-sm",
                size === "sm" && "line-clamp-1 text-xs",
              )}
            >
              {banner.subtitle}
            </p>
          )}
        </div>
      )}

      {banner.cta && (
        <span
          className={cn(
            "relative inline-flex w-fit items-center gap-1.5 rounded-full bg-white/95 font-semibold text-slate-900 transition-transform group-hover:translate-x-0.5",
            size === "sm" ? "mt-2 px-3 py-1 text-xs" : "mt-4 px-4 py-2 text-sm",
          )}
        >
          {banner.cta}
          <ArrowRight className={size === "sm" ? "size-3" : "size-4"} />
        </span>
      )}
    </Link>
  );
}
