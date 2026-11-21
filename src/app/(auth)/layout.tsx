import { storePageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLink } from "@/components/layout/logo";
import { getStoreBrand } from "@/lib/server/store-presentation";
export async function generateMetadata(): Promise<Metadata> {
  return storePageMetadata({
  robots: { index: false, follow: false },
});
}


export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mismo contexto validado en servidor que el resto de la tienda.
  // Antes estas pantallas dibujaban su propia versión del
  // nombre con un icono genérico, es decir, una segunda marca inventada
  // conviviendo con la real.
  const brand = await getStoreBrand();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Filete rojo dominante: en una pantalla tan sobria es lo que mantiene
          presente la marca sin competir con el formulario. */}
      <span aria-hidden className="h-1 w-full shrink-0 bg-brand" />

      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <BrandLink brand={brand.logo} imageClassName="h-8 sm:h-9" />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>

      <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
        <p>{brand.tagline}</p>
        <p className="mt-1">
          © {new Date().getFullYear()} {brand.name} · Compra protegida
        </p>
      </footer>
    </div>
  );
}
