import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { DEFAULT_STORE_BRAND } from "@/components/layout/store-brand";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Punto único donde se decide la marca de la tienda. Hoy es el valor por
  // defecto; cuando el backend exponga resolución de tienda, se resuelve aquí
  // y ni la cabecera ni el pie tienen que cambiar.
  const brand = DEFAULT_STORE_BRAND;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader brand={brand} />
      <main className="flex-1">{children}</main>
      <Footer brand={brand} />
    </div>
  );
}
