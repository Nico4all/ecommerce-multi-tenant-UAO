import { TopBar } from "@/components/layout/top-bar";
import { Header } from "@/components/layout/header";
import { CategoryNav } from "@/components/layout/category-nav";
import { getCategories } from "@/lib/queries";

export async function SiteHeader() {
  const categories = await getCategories();

  return (
    <header className="sticky top-0 z-40 bg-background">
      <TopBar />
      <Header categories={categories} />
      <CategoryNav categories={categories} />
    </header>
  );
}
