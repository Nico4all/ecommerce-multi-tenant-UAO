import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  DEFAULT_STORE_BRAND,
  type BrandAsset,
} from "@/components/layout/store-brand";

/**
 * Marca desacoplada.
 *
 * La plataforma es multi-tienda, así que el componente no conoce ningún
 * logotipo concreto: recibe un `BrandAsset` y lo pinta. `STORE_BRAND` es el de
 * la tienda activa y es el único que se publica de cara al cliente.
 *
 * La marca institucional UAO vive aparte, en `AcademicBrandMark`, y queda
 * limitada a demostración académica: aplicar la guía visual del manual no
 * autoriza a usar la marca universitaria en un sitio comercial ni a aparentar
 * aval institucional.
 *
 * El activo se sirve como archivo desde /public en vez de incrustar el SVG:
 * así el navegador lo cachea, y sobre todo se evita que los `id` de sus
 * degradados choquen si el logo sale dos veces en la misma página, que es
 * cuando los degradados dejan de pintarse.
 */

export type { BrandAsset };

/**
 * Logotipo de la tienda por defecto. Se mantiene como export propio porque es
 * el que usan los componentes que no reciben marca por prop.
 */
export const STORE_BRAND: BrandAsset = DEFAULT_STORE_BRAND.logo;

/**
 * Activo autorizado de la marca institucional.
 *
 * Hoy es `null` a propósito. Los PDF del manual traen el logotipo troceado en
 * mosaicos rasterizados dentro de las páginas, no como activo completo, y
 * recomponerlo sería redibujarlo, que el manual prohíbe expresamente. Tampoco
 * consta autorización para publicar la marca universitaria en una tienda
 * comercial.
 *
 * Cuando exista un activo oficial basta con dejarlo en `public/branding/` y
 * apuntarlo aquí; hay que volver a medir `UAO_X_RATIO` sobre ese archivo.
 */
export const UAO_ACADEMIC_BRAND: BrandAsset | null = null;

/**
 * Tamaño mínimo en medios digitales (manual de identidad, pág. 13), en
 * píxeles de ancho, para garantizar la legibilidad del logotipo.
 */
export const UAO_MIN_DIGITAL_WIDTH_PX = {
  /** Símbolo suelto. */
  symbol: 50,
  /** Versión vertical con descriptivo. */
  vertical: 110,
  /** Versión horizontal con descriptivo. */
  horizontal: 200,
} as const;

export type UaoLockup = keyof typeof UAO_MIN_DIGITAL_WIDTH_PX;

/**
 * Área de protección (manual, págs. 5-8). La unidad X es la altura de la letra
 * "O" del logotipo: 1X alrededor en el caso general y 1/2X cuando el espacio
 * disponible es reducido. Ningún otro elemento puede invadir ese margen.
 */
export const UAO_RESERVE_RATIO = { full: 1, reduced: 0.5 } as const;

export type UaoReserve = keyof typeof UAO_RESERVE_RATIO;

/**
 * Altura de la "O" como fracción de la altura del lockup. Es una estimación
 * conservadora mientras no haya activo oficial que medir: ante la duda reserva
 * de más, nunca de menos.
 */
const UAO_X_RATIO = 0.5;

/** Altura por defecto de la marca, equivalente a `h-9` de Tailwind. */
const DEFAULT_MARK_HEIGHT = "2.25rem";

/**
 * Imagen de una marca cualquiera. Toma la altura por clase y deja el ancho en
 * `auto`, así escala sin deformarse. `max-w-full` evita que se desborde en
 * contenedores estrechos (el menú lateral del móvil mide 320px) y `h-auto`
 * mantiene la proporción si eso llega a pasar.
 */
export function BrandMark({
  brand = STORE_BRAND,
  className,
}: {
  brand?: BrandAsset;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático de marca: next/image no lo optimiza y añadiría trabajo para nada
    <img
      src={brand.src}
      alt={brand.alt}
      width={brand.width}
      height={brand.height}
      className={cn("w-auto max-w-full", className ?? "h-9 sm:h-10")}
    />
  );
}

/** Marca enlazada al inicio de la tienda. */
export function BrandLink({
  brand = STORE_BRAND,
  className,
  imageClassName,
  href = "/",
}: {
  brand?: BrandAsset;
  className?: string;
  imageClassName?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${brand.alt} — Ir al inicio`}
      className={cn(
        "flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
    >
      <BrandMark brand={brand} className={imageClassName} />
    </Link>
  );
}

/**
 * Marca institucional UAO para muestra académica.
 *
 * Respeta el área de reserva y el tamaño mínimo del manual. Mientras no haya
 * un activo autorizado pinta un marcador neutro: no imita el logotipo ni
 * afirma aval institucional. No se monta en las páginas públicas de la tienda.
 *
 * La altura se controla con la variable CSS `--brand-mark-height`, de la que
 * se deriva el área de reserva.
 */
export function AcademicBrandMark({
  lockup = "horizontal",
  reserve = "reduced",
  height = DEFAULT_MARK_HEIGHT,
  className,
}: {
  lockup?: UaoLockup;
  reserve?: UaoReserve;
  height?: string;
  className?: string;
}) {
  const padding = `calc(${UAO_RESERVE_RATIO[reserve] * UAO_X_RATIO} * ${height})`;

  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={{ padding, minWidth: UAO_MIN_DIGITAL_WIDTH_PX[lockup] }}
    >
      {UAO_ACADEMIC_BRAND ? (
        // eslint-disable-next-line @next/next/no-img-element -- mismo motivo que en BrandMark
        <img
          src={UAO_ACADEMIC_BRAND.src}
          alt={UAO_ACADEMIC_BRAND.alt}
          width={UAO_ACADEMIC_BRAND.width}
          height={UAO_ACADEMIC_BRAND.height}
          className="w-auto max-w-full"
          style={{ height }}
        />
      ) : (
        <span
          role="img"
          aria-label="Espacio reservado para la marca institucional"
          title="Muestra académica: pendiente de un activo autorizado. No implica aval institucional."
          className="grid place-items-center rounded-md border border-dashed border-border bg-muted px-3 text-center text-[11px] leading-tight font-medium text-muted-foreground"
          style={{ minHeight: height }}
        >
          Marca institucional
        </span>
      )}
    </span>
  );
}

/**
 * Alias históricos de la marca de la tienda. Los mantiene la cabecera, el pie,
 * el menú móvil y el panel de administración.
 */
export const LogoImage = BrandMark;
export const Logo = BrandLink;
