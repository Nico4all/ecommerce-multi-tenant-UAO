import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/product/product-image";
import { RatingStars } from "@/components/product/rating-stars";
import { PriceTag } from "@/components/product/price-tag";
import { WishlistHeart } from "@/components/product/wishlist-heart";
import type { Product } from "@/types";

export function ProductCard({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-lg border border-border bg-card p-3 transition-shadow hover:shadow-md",
        className,
      )}
    >
      {/* Wishlist */}
      <WishlistHeart productId={product.id} productName={product.name} />

      <Link
        href={`/product/${product.slug}`}
        className="flex flex-1 flex-col outline-none"
      >
        <div className="relative">
          <ProductImage
            src={product.imageUrl}
            category={product.category}
            name={product.name}
            className="aspect-square w-full rounded-md"
          />
          {product.badge && (
            <Badge className="absolute left-2 top-2 bg-deal text-deal-foreground hover:bg-deal">
              {product.badge}
            </Badge>
          )}
        </div>

        <div className="mt-3 flex flex-1 flex-col gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </p>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary">
            {product.name}
          </h3>
          <RatingStars rating={product.rating} reviews={product.reviews} className="mt-0.5" />
          <div className="mt-auto pt-1.5">
            <PriceTag price={product.price} oldPrice={product.oldPrice} />
            {product.shippingCost === 0 && (
              <p className="mt-1 text-[11px] font-medium text-success">
                Envío gratis
              </p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
