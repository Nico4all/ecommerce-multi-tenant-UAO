import { getCategories } from "@/lib/queries";
import { HomeSectionForm } from "@/components/admin/home-section-form";

export default async function NewHomeSectionPage() {
  const categories = await getCategories();
  return <HomeSectionForm categories={categories} />;
}
