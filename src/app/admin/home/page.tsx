import { HomeSectionsManager } from "@/components/admin/home-sections-manager";
import { listHomeSections } from "@/lib/server/admin/home-sections";
import { getCategories } from "@/lib/queries";

export default async function AdminHomePage() {
  const [sections, categories] = await Promise.all([
    listHomeSections(),
    getCategories(),
  ]);
  return <HomeSectionsManager sections={sections} categories={categories} />;
}
