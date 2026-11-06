import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategory, getProducts, getBrands } from "@/lib/queries";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { CatalogView } from "@/components/catalog/catalog-view";
import { SITE_NAME, seoDescription } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) {
    return {
      title: "Categoría no encontrada",
      robots: { index: false, follow: false },
    };
  }

  const description = seoDescription(
    category.description,
    `Compra productos de ${category.name.toLowerCase()} en ${SITE_NAME}, tienda online con atención desde Cali para Colombia.`,
  );

  return {
    title: `${category.name} — ${SITE_NAME}`,
    description,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      type: "website",
      url: `/category/${category.slug}`,
      siteName: SITE_NAME,
      locale: "es_CO",
      title: `${category.name} — ${SITE_NAME}`,
      description,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const [products, brands] = await Promise.all([
    getProducts({ category: slug }),
    getBrands(slug),
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <Breadcrumbs items={[{ label: "Categorías", href: "/" }, { label: category.name }]} />
      <h1 className="mb-5 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        {category.name}
      </h1>
      {category.description && (
        <p className="-mt-3 mb-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {category.description}
        </p>
      )}
      <CatalogView products={products} brands={brands} />
    </div>
  );
}
