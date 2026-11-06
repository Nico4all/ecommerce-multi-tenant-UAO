import { notFound } from "next/navigation";
import { getCategories } from "@/lib/queries";
import { getAdminProduct } from "@/lib/server/admin/products";
import { ProductEditor } from "@/components/admin/product-editor";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getAdminProduct(id),
    getCategories(),
  ]);
  if (!product) notFound();

  return <ProductEditor product={product} categories={categories} />;
}
