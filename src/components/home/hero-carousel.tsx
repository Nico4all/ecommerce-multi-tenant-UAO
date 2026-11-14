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

  // Con un solo banner no hay a dónde ir: los controles sobran y los puntos
  // se leerían como una paginación de un elemento.
  const navigable = slides.length > 1;

  React.useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  // Autoplay: respeta prefers-reduced-motion y se pausa si la pestaña no está visible.
  React.useEffect(() => {
    if (!api || !navigable) return;
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
  }, [api, navigable]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* min-w-0: una celda de rejilla no se encoge por debajo de su
          contenido salvo que se le diga. Sin esto, el carril del carrusel
          hacia 526px de ancho dentro de una celda de 328px y la portada
          entera se desplazaba de lado a 360px. */}
      <div
        className={cn(
          "relative min-w-0",
          sides.length ? "lg:col-span-2" : "lg:col-span-3",
        )}
      >
        <Carousel setApi={setApi} opts={{ loop: true }} className="w-full">
          <CarouselContent>
            {slides.map((slide) => (
              <CarouselItem key={slide.id}>
                {/* Proporción en vez de altura fija: las imágenes del hero son
                    anchas (3:1) y con una altura fija se recortaban demasiado en
                    móvil. Con aspect-ratio escalan y se recortan menos; en
                    escritorio se mantiene la altura fija de antes.

                    A 360px la proporción 2:1 dejaba la tarjeta en 164px de alto
                    para un contenido de 212px: con overflow-hidden, el botón
                    "Comprar ahora" quedaba cortado por debajo del borde. 4:3 da
                    246px y entra entero. */}
                <BannerCard
                  banner={slide}
                  size="lg"
                  className="aspect-[4/3] sm:aspect-[5/2] lg:aspect-auto lg:h-72"
                />
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Las flechas van en crema y tinta en vez de blanco y slate: el
              blanco fijo se quedaba igual en modo oscuro, donde era el único
              punto frío de la portada. */}
          {navigable && (
            <>
              {/* Ocultas en móvil: a 328px de ancho se montaban encima del
                  titular. Ahí quedan los puntos, que además indican cuántos
                  banners hay, y el arrastre del propio carrusel. */}
              <CarouselPrevious className="left-3 z-20 hidden size-10 border-0 bg-media/90 text-media-foreground shadow-md hover:bg-media sm:inline-flex" />
              <CarouselNext className="right-3 z-20 hidden size-10 border-0 bg-media/90 text-media-foreground shadow-md hover:bg-media sm:inline-flex" />
            </>
          )}
        </Carousel>

        {/* Paginación. El punto sigue siendo pequeño, pero el botón que lo
            contiene mide 24px: antes el área pulsable era de 8px de alto, por
            debajo del mínimo de 24x24 de WCAG 2.5.8. El velo detrás los
            mantiene visibles también sobre un banner claro, donde los puntos
            blancos de antes desaparecían. */}
        {/* A la derecha en movil: centrados se montaban sobre el boton del
            banner, que ocupa la esquina inferior izquierda. */}
        {navigable && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-end sm:justify-center">
            <div className="pointer-events-auto m-3 flex items-center gap-0.5 rounded-full bg-black/35 px-1.5 py-0.5 backdrop-blur-sm">
              {slides.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Ir al banner ${i + 1} de ${slides.length}`}
                  aria-current={current === i ? "true" : undefined}
                  onClick={() => api?.scrollTo(i)}
                  className="grid size-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-media"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      current === i ? "w-5 bg-media" : "w-1.5 bg-media/60",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
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
