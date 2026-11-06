import { ImageUp, Pencil } from "lucide-react";
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
      <div className={cn("group relative", ratio)}>
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

        {/* Overlay acciones */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-md bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900"
          >
            <ImageUp className="size-3.5" />
            Reemplazar
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/40"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="truncate text-xs text-muted-foreground">
          → {banner.href}
        </span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {banner.cta ?? "Sin botón"}
        </span>
      </div>
    </div>
  );
}
