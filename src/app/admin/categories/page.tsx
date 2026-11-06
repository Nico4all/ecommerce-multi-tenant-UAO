import { listAdminCategories } from "@/lib/server/admin/categories";
import { CategoriesManager } from "@/components/admin/categories-manager";

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();
  return <CategoriesManager categories={categories} />;
}
