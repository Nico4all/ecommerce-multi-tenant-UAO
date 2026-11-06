import { BannerCard } from "@/components/home/banner-card";
import type { Banner } from "@/types";

export function PromoBanners({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {banners.map((b) => (
        <BannerCard key={b.id} banner={b} className="h-48" />
      ))}
    </section>
  );
}
