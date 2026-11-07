import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Banner } from "@/types";

/**
 * Franjas anchas: renderiza TODAS las activas, apiladas.
 *
 * Con imagen propia, esta es el fondo y el icono decorativo desaparece: si el
 * admin subió una gráfica, la chispa encima sobra. Texto y botón son opcionales;
 * la franja entera es el enlace.
 *
 * El título de la franja va como párrafo y no como `h2`: los `h2` del inicio
 * son los encabezados de sección, y meter uno más por cada promoción llenaba
 * el esquema del documento de títulos que no abren ninguna sección. El peso
 * visual se mantiene con tipografía, que es lo que la promoción necesita.
 */
export function PromoStrip({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;

  return (
    <section className="space-y-4">
      {banners.map((banner) => {
        const hasImage = !!banner.imageUrl;
        const hasText = !!(banner.title || banner.subtitle || banner.highlight);

        return (
          <Link
            key={banner.id}
            href={banner.href}
            aria-label={hasText ? undefined : `Ver ${banner.href}`}
            className={cn(
              "group relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-xl p-6 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:p-8",
              hasImage ? "min-h-40 bg-media-foreground text-media" : banner.className,
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
                {(hasText || banner.cta) && (
                  <span className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                )}
              </>
            ) : (
              <span className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-white/10 blur-3xl" />
            )}

            {hasText && (
              <div className="relative flex items-center gap-4">
                {!hasImage && (
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur">
                    <Sparkles className="size-6" />
                  </span>
                )}
                <div className="min-w-0">
                  {banner.highlight && (
                    <span className="block font-heading text-2xl font-extrabold leading-none tracking-tight drop-shadow-sm sm:text-3xl">
                      {banner.highlight}
                    </span>
                  )}
                  {banner.title && (
                    <p className="font-heading text-xl font-bold leading-tight sm:text-2xl">
                      {banner.title}
                    </p>
                  )}
                  {banner.subtitle && (
                    <p className="mt-0.5 text-sm opacity-90 sm:text-base">
                      {banner.subtitle}
                    </p>
                  )}
                </div>
              </div>
            )}

            {banner.cta && (
              <span className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-media px-5 py-2.5 text-sm font-semibold text-media-foreground transition-transform group-hover:translate-x-0.5 sm:ml-auto">
                {banner.cta}
                <ArrowRight className="size-4" />
              </span>
            )}
          </Link>
        );
      })}
    </section>
  );
}
