import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import {
  FacebookIcon,
  InstagramIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/social-icons";
import {
  DEFAULT_STORE_BRAND,
  type StoreBrand,
  type StoreSocialPlatform,
} from "@/components/layout/store-brand";

/** Icono y etiqueta de cada red. La tienda decide cuáles declara. */
const SOCIAL: Record<
  StoreSocialPlatform,
  { Icon: typeof FacebookIcon; label: string }
> = {
  facebook: { Icon: FacebookIcon, label: "Facebook" },
  instagram: { Icon: InstagramIcon, label: "Instagram" },
  x: { Icon: XIcon, label: "X" },
  youtube: { Icon: YoutubeIcon, label: "YouTube" },
};

/** Cada enlace apunta a una ruta que existe: nada de href="#". */
const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Comprar",
    links: [
      { label: "Ofertas del día", href: "/deals" },
      { label: "Mejor calificados", href: "/search?sort=rating" },
      { label: "Mayor descuento", href: "/search?sort=discount" },
      { label: "Todas las categorías", href: "/categories" },
    ],
  },
  {
    title: "Mi cuenta",
    links: [
      { label: "Iniciar sesión", href: "/login" },
      { label: "Crear cuenta", href: "/register" },
      { label: "Mis pedidos", href: "/orders" },
      { label: "Favoritos", href: "/wishlist" },
      { label: "Carrito", href: "/cart" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Centro de ayuda", href: "/ayuda" },
      { label: "Envíos y entregas", href: "/ayuda#envios" },
      { label: "Devoluciones", href: "/ayuda#devoluciones" },
      { label: "Pagos", href: "/ayuda#pagos" },
    ],
  },
  {
    title: "Atención al cliente",
    links: [
      { label: "Contáctanos", href: "/contacto" },
      { label: "Radicar una PQR", href: "/pqr" },
      { label: "Rastrear mi pedido", href: "/orders" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos y condiciones", href: "/terminos" },
      { label: "Política de privacidad", href: "/privacidad" },
      { label: "Tratamiento de datos", href: "/datos-personales" },
      { label: "Retracto y garantías", href: "/retracto" },
    ],
  },
];

export function Footer({
  brand = DEFAULT_STORE_BRAND,
}: {
  brand?: StoreBrand;
}) {
  return (
    <footer className="mt-12 bg-card">
      {/* Remate rojo que cierra la página igual que la franja abre la cabecera. */}
      <div aria-hidden className="h-1 bg-brand" />

      <div className="mx-auto max-w-[1280px] px-4 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2 md:col-span-1">
            <Logo brand={brand.logo} imageClassName="h-10" />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              {brand.tagline}
            </p>
            {brand.social.length > 0 && (
              <div className="mt-4 flex gap-2">
                {brand.social.map(({ platform, href }) => {
                  const { Icon, label } = SOCIAL[platform];
                  return (
                    <a
                      key={platform}
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={label}
                      className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-primary"
                    >
                      <Icon className="size-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {brand.name}. Todos los derechos
            reservados.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/terminos" className="hover:text-foreground">
              Términos
            </Link>
            <Link href="/datos-personales" className="hover:text-foreground">
              Datos personales
            </Link>
            <Link href="/pqr" className="hover:text-foreground">
              PQR
            </Link>
            <Link
              href="/admin"
              className="font-medium text-primary hover:underline"
            >
              Panel admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
