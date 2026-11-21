import { getStoreBrand } from "@/lib/server/store-presentation";
import { TopBar } from "@/components/layout/top-bar";
import { Header } from "@/components/layout/header";
import { CategoryNav } from "@/components/layout/category-nav";
import { getCategories } from "@/lib/queries";
import {
  type StoreBrand,
} from "@/components/layout/store-brand";

export async function SiteHeader({
  brand: suppliedBrand,
}: {
  brand?: StoreBrand;
}) {
  const brand = suppliedBrand ?? await getStoreBrand();
  const categories = await getCategories();

  return (
    <header className="sticky top-0 z-40 bg-card shadow-sm">
      {/* Franja del rojo dominante. Es decorativa, así que puede ir en #FF051E
          puro sin comprometer el contraste de ningún texto, y asegura que el
          rojo esté siempre presente como pide el manual. */}
      <div aria-hidden className="h-1 bg-brand" />
      <TopBar />
      <Header categories={categories} brand={brand} />
      <CategoryNav categories={categories} />
    </header>
  );
}
