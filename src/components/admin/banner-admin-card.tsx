import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Banner } from "@/types";

/**
 * Tarjeta de un banner en el panel.
 *
 * La vista previa refleja lo que se verá en la tienda: si hay imagen, esa es el
 * fondo (antes solo se pintaba el gradiente y por eso las imágenes subidas
 * parecían no guardarse). Texto y botón son opcionales.
 */
export function BannerAdminCard({
  banner,
  ratio = "aspect-[16/6]",
  onEdit,
}: {
  banner: Banner;
  ratio?: string;
  onEdit?: () => void;
}) {
  const hasImage = !!banner.imageUrl;
  const hasText = !!(banner.title || banner.subtitle || banner.highlight);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Preview */}
      <div className={cn("relative", ratio)}>
        <div
          className={cn(
            "relative flex h-full flex-col justify-center overflow-hidden p-4",
            hasImage ? "bg-slate-900 text-white" : banner.className,
          )}
        >
          {hasImage && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- ruta subida o URL externa del admin */}
              <img
                src={banner.imageUrl as string}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full object-cover"
              />
              {hasText && (
                <span className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
              )}
            </>
          )}

          {hasText ? (
            <div className="relative min-w-0">
              {banner.highlight && (
                <span className="block font-heading text-lg font-extrabold leading-none">
                  {banner.highlight}
                </span>
              )}
              {banner.title && (
                <span className="block font-heading text-sm font-bold">
                  {banner.title}
                </span>
              )}
              {banner.subtitle && (
                <span className="mt-0.5 line-clamp-1 block text-xs opacity-90">
                  {banner.subtitle}
                </span>
              )}
            </div>
          ) : (
            !hasImage && (
              <span className="relative text-xs opacity-70">Sin contenido</span>
            )
          )}
        </div>

      </div>

      {/* Meta y acción */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          → {banner.href}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {banner.cta ?? "Sin botón"}
          </span>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-semibold outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil aria-hidden className="size-3.5" />
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}
