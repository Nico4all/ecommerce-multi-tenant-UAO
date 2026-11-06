import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/admin/page-heading";
import { ProductsTable } from "@/components/admin/products-table";
import { listAdminProducts } from "@/lib/server/admin/products";
import { getCategories } from "@/lib/queries";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    listAdminProducts(),
    getCategories(),
  ]);

  return (
    <div>
      <PageHeading
        title="Productos"
        description={`${products.length} productos en el catálogo`}
      >
        <Link
          href="/admin/products/new"
          className={cn(buttonVariants({ size: "default" }), "h-9 gap-2")}
        >
          <Plus className="size-4" />
          Nuevo producto
        </Link>
      </PageHeading>

      <ProductsTable products={products} categories={categories} />
    </div>
  );
}
