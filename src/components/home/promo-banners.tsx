import { cn } from "@/lib/utils";
import { BannerCard } from "@/components/home/banner-card";
import type { Banner } from "@/types";

/**
 * Rejilla de banners promocionales.
 *
 * El número de columnas sale de cuántos banners activó el administrador: con
 * tres columnas fijas, dos banners dejaban un hueco de un tercio y cuatro
 * dejaban uno huérfano en la segunda fila.
 */
function columnsFor(count: number) {
  if (count === 1) return "sm:grid-cols-1";
  if (count === 2) return "sm:grid-cols-2";
  if (count % 4 === 0) return "sm:grid-cols-2 lg:grid-cols-4";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

export function PromoBanners({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;

  return (
    <section className={cn("grid gap-4", columnsFor(banners.length))}>
      {banners.map((b) => (
        <BannerCard key={b.id} banner={b} className="h-44 sm:h-48" />
      ))}
    </section>
  );
}
