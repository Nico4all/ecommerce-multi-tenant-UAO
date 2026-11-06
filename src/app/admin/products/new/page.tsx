import { getCategories } from "@/lib/queries";
import { ProductEditor } from "@/components/admin/product-editor";

export default async function NewProductPage() {
  const categories = await getCategories();
  return <ProductEditor categories={categories} />;
}
