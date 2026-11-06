"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { BannerCard } from "@/components/home/banner-card";
import type { Banner } from "@/types";

export function HeroCarousel({
  slides,
  sides,
}: {
  slides: Banner[];
  sides: Banner[];
}) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  // Autoplay: respeta prefers-reduced-motion y se pausa si la pestaña no está visible.
  React.useEffect(() => {
    if (!api) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      stop();
      id = setInterval(() => {
        if (!document.hidden) api.scrollNext();
      }, 5000);
    };
    const stop = () => id && clearInterval(id);

    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", start);
    };
  }, [api]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className={cn("relative", sides.length ? "lg:col-span-2" : "lg:col-span-3")}>
        <Carousel setApi={setApi} opts={{ loop: true }} className="w-full">
          <CarouselContent>
            {slides.map((slide) => (
              <CarouselItem key={slide.id}>
                {/* Proporción en vez de altura fija: las imágenes del hero son
                    anchas (3:1) y con una altura fija se recortaban demasiado en
                    móvil. Con aspect-ratio escalan y se recortan menos; en
                    escritorio se mantiene la altura fija de antes. */}
                <BannerCard
                  banner={slide}
                  size="lg"
                  className="aspect-[2/1] sm:aspect-[5/2] lg:aspect-auto lg:h-72"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-3 z-20 size-10 border-0 bg-white/90 text-slate-900 shadow-md hover:bg-white" />
          <CarouselNext className="right-3 z-20 size-10 border-0 bg-white/90 text-slate-900 shadow-md hover:bg-white" />
        </Carousel>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Ir al banner ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                "h-2 rounded-full bg-white/60 transition-all",
                current === i ? "w-6 bg-white" : "w-2",
              )}
            />
          ))}
        </div>
      </div>

      {/* Laterales: se reparten la altura del carrusel sin deformarse.
          1 lateral = tarjeta grande; 2+ = tarjetas compactas en rejilla. */}
      {sides.length > 0 && (
        <div
          className={cn(
            "grid gap-4 lg:h-72 lg:auto-rows-fr",
            sides.length === 1 ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-1",
          )}
        >
          {sides.map((b) => (
            <BannerCard
              key={b.id}
              banner={b}
              // "lg" es la letra grande pensada para el hero principal (más
              // ancho y alto). En esta tarjeta, más angosta, ese tamaño no
              // cabía en móvil y el botón "Comprar" quedaba cortado por el
              // overflow-hidden de la tarjeta. "md" es el mismo tamaño que ya
              // usan las promos de abajo (con una altura parecida) y sí cabe.
              size={sides.length === 1 ? "md" : "sm"}
              className={cn(
                "min-h-0",
                sides.length === 1 ? "h-48 sm:h-56 lg:h-full" : "h-32 lg:h-full",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
