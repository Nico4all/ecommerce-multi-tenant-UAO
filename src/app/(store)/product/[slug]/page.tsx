import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck, RotateCcw } from "lucide-react";
import { getProduct, getRelatedProducts, getCategory } from "@/lib/queries";
import { getProductDetail } from "@/lib/server/catalog";
import { getReviewEligibility } from "@/lib/server/reviews";
import { ReviewForm } from "@/components/product/review-form";
import { categoryBySlug } from "@/data/categories";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { AutoRefresh } from "@/components/auto-refresh";
import { ProductGallery } from "@/components/product/product-gallery";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { RatingStars } from "@/components/product/rating-stars";
import { PriceTag } from "@/components/product/price-tag";
import { ProductRow } from "@/components/home/product-row";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatCount, formatPrice } from "@/lib/format";
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  seoDescription,
  serializeJsonLd,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    return {
      title: "Producto no encontrado",
      robots: { index: false, follow: false },
    };
  }

  const description = seoDescription(
    `${product.name} de ${product.brand}. Compra online en ${SITE_NAME} con envío y seguimiento en Colombia.`,
  );
  const images = product.imageUrl ? [absoluteUrl(product.imageUrl)] : undefined;

  return {
    title: `${product.name} — ${SITE_NAME}`,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      url: `/product/${product.slug}`,
      siteName: SITE_NAME,
      locale: "es_CO",
      title: `${product.name} — ${SITE_NAME}`,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} — ${SITE_NAME}`,
      description,
      images,
    },
  };
}

// Solo lo que la tienda puede cumplir de verdad: el retracto de 30 días es un
// derecho de ley (Ley 1480) y el pago va por la pasarela. Se quitaron las
// promesas de "envío rápido" y "garantía de 12 meses": no son sostenibles.
const trust = [
  { icon: RotateCcw, title: "30 días", desc: "Devolución gratis" },
  { icon: ShieldCheck, title: "Pago seguro", desc: "Compra protegida" },
];

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await getProductDetail(slug);
  if (!detail) notFound();
  const { product } = detail;

  const [related, category, reviewEligibility] = await Promise.all([
    getRelatedProducts(product),
    getCategory(product.category),
    getReviewEligibility(product.id).catch(
      () => ({ canReview: false, reason: "not-logged" as const, myReview: null }),
    ),
  ]);
  const cat = category ?? categoryBySlug[product.category];

  // Qué decir en la ficha sobre el envío de ESTE producto.
  const shippingLabel =
    product.shippingCost === 0
      ? "Gratis"
      : typeof product.shippingCost === "number"
        ? formatPrice(product.shippingCost)
        : "Calculado en checkout";

  const availableStock = detail.variants.length
    ? detail.variants.reduce((total, variant) => total + variant.stock, 0)
    : detail.stock;
  const productDescription = seoDescription(
    detail.description,
    `${product.name} de ${product.brand}, disponible en ${SITE_NAME}.`,
  );
  const productImages = detail.images.map(absoluteUrl);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE_URL}/product/${product.slug}#product`,
    name: product.name,
    description: productDescription,
    image: productImages.length ? productImages : undefined,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    category: cat.name,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${product.slug}`,
      priceCurrency: "COP",
      price: product.price.toFixed(2),
      availability:
        availableStock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${SITE_URL}/#organization` },
    },
    aggregateRating:
      product.reviews > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating.toFixed(1),
            reviewCount: product.reviews,
          }
        : undefined,
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
      />
      {/* Stock y precio al día mientras el cliente mira la ficha. Intervalo
          largo: es la página más visitada y el stock se revalida al pagar. */}
      <AutoRefresh seconds={60} />
      <Breadcrumbs
        items={[
          { label: cat.name, href: `/category/${product.category}` },
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery
          category={product.category}
          name={product.name}
          images={detail.images}
        />

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RatingStars rating={product.rating} reviews={product.reviews} />
            {product.badge && (
              <Badge className="bg-deal text-deal-foreground hover:bg-deal">
                {product.badge}
              </Badge>
            )}
          </div>

          <div className="mt-4">
            <PriceTag price={product.price} oldPrice={product.oldPrice} size="lg" />
            <p className="mt-1 text-xs text-muted-foreground">
              Impuestos incluidos.{" "}
              {product.shippingCost === 0 && (
                <span className="font-medium text-success-ink">Envío gratis.</span>
              )}
            </p>
          </div>

          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-brand">
            <li>{product.brand} original.</li>
            <li>Envío con seguimiento del pedido.</li>
            <li>Devolución gratuita dentro de los primeros 30 días.</li>
          </ul>

          <Separator className="my-6" />

          <PurchasePanel
            slug={product.slug}
            stock={detail.stock}
            variants={detail.variants}
          />

          <div className="mt-6 grid grid-cols-2 gap-3">
            {trust.map((t) => (
              <div
                key={t.title}
                className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3 text-center"
              >
                <t.icon className="size-5 text-primary" />
                <p className="text-xs font-semibold">{t.title}</p>
                <p className="text-[11px] text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detalles */}
      <div className="mt-12">
        <Tabs defaultValue="descripcion">
          <TabsList
            variant="line"
            className="no-scrollbar h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border p-0 sm:gap-6"
          >
            <TabsTrigger
              value="descripcion"
              className="shrink-0 flex-none px-0 pb-3 text-base data-active:text-primary"
            >
              Descripción
            </TabsTrigger>
            <TabsTrigger
              value="especificaciones"
              className="shrink-0 flex-none px-0 pb-3 text-base data-active:text-primary"
            >
              Especificaciones
            </TabsTrigger>
            <TabsTrigger
              value="resenas"
              className="shrink-0 flex-none px-0 pb-3 text-base data-active:text-primary"
            >
              Reseñas ({formatCount(product.reviews)})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="descripcion" className="max-w-3xl pt-4 text-sm leading-relaxed text-muted-foreground">
            {detail.description ? (
              <p>{detail.description}</p>
            ) : (
              <p>
                Todavía no hay una descripción ampliada de este producto. En
                Especificaciones están los datos confirmados y en Reseñas, lo
                que cuentan quienes ya lo compraron.
              </p>
            )}
            <p className="mt-3">
              Compra con confianza en {SITE_NAME}: seguimiento de tu pedido y
              soporte cuando lo necesites.
            </p>
          </TabsContent>

          <TabsContent value="especificaciones" className="pt-6">
            <div className="max-w-2xl overflow-hidden rounded-lg border border-border">
              <dl className="text-sm">
                {(detail.specs.length
                  ? [
                      ...detail.specs.map((s): [string, string] => [s.key, s.value]),
                      ["Categoría", cat.name] as [string, string],
                      [
                        "Envío",
                        shippingLabel,
                      ] as [string, string],
                    ]
                  : ([
                      ["Marca", product.brand],
                      ["Categoría", cat.name],
                      ["Envío", shippingLabel],
                      ["Calificación", `${product.rating} / 5`],
                    ] as [string, string][])
                ).map(([k, v], i) => (
                  <div
                    key={k}
                    className={
                      "grid grid-cols-3 gap-4 px-4 py-3 " +
                      (i % 2 === 1 ? "bg-muted/40" : "")
                    }
                  >
                    <dt className="font-medium text-foreground">{k}</dt>
                    <dd className="col-span-2 text-muted-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </TabsContent>

          <TabsContent value="resenas" className="pt-4">
            <div className="flex flex-col gap-6 sm:flex-row">
              <div className="flex flex-col items-center rounded-lg border border-border bg-card p-6 sm:w-56">
                <span className="font-heading text-4xl font-bold tabular-nums">
                  {product.rating.toFixed(1)}
                </span>
                <RatingStars rating={product.rating} className="mt-1" />
                <span className="mt-1 text-xs text-muted-foreground">
                  {formatCount(product.reviews)} reseñas
                </span>
              </div>
              <div className="flex-1 space-y-4">
                <ReviewForm slug={product.slug} eligibility={reviewEligibility} />
                {detail.reviews.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Aún no hay reseñas de este producto. ¡Sé el primero en
                    comprarlo y contarnos qué tal!
                  </div>
                )}
                {detail.reviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{r.userName}</span>
                      <RatingStars rating={r.rating} />
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{r.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {r.createdAt.slice(0, 10)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Relacionados */}
      {related.length > 0 && (
        <div className="mt-12">
          <ProductRow
            title="Productos relacionados"
            href={`/category/${product.category}`}
            products={related}
          />
        </div>
      )}
    </div>
  );
}
