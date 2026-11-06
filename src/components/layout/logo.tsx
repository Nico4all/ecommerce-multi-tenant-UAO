import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo de la marca.
 *
 * Se sirve como archivo desde /public en vez de incrustar el SVG: así el
 * navegador lo cachea, y sobre todo se evita que los `id` de sus degradados
 * (`green`, `orange`, `beige`) choquen si el logo sale dos veces en la misma
 * página, que es cuando los degradados dejan de pintarse.
 *
 * `LogoImage` es solo la imagen, para sitios que ya están dentro de un enlace
 * (o donde no debe haberlo, como el título de un panel lateral). `Logo` la
 * envuelve en un enlace al inicio. Ambos toman la altura por clase y dejan el
 * ancho en `auto`, así el logo escala sin deformarse en cualquier pantalla.
 */

/** Proporción real del archivo (640x150), para reservar el hueco al cargar. */
const RATIO = { width: 640, height: 150 };

export function LogoImage({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático de marca: next/image no lo optimiza y añadiría trabajo para nada
    <img
      src="/logo-variedades-los-primos.svg"
      alt="Variedades Los Primos"
      width={RATIO.width}
      height={RATIO.height}
      // `max-w-full` evita que se desborde en contenedores estrechos (el menú
      // lateral del móvil mide 320px) y `h-auto` mantiene la proporción si eso
      // llega a pasar.
      className={cn("w-auto max-w-full", className ?? "h-9 sm:h-10")}
    />
  );
}

export function Logo({
  className,
  imageClassName,
  href = "/",
}: {
  className?: string;
  imageClassName?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Variedades Los Primos — Ir al inicio"
      className={cn(
        "flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
    >
      <LogoImage className={imageClassName} />
    </Link>
  );
}
