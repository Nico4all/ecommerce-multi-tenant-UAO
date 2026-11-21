import { cn } from "@/lib/utils";
import { formatPrice, discountPercent } from "@/lib/format";

export function PriceTag({
  price,
  oldPrice,
  size = "md",
  className,
}: {
  price: number;
  oldPrice?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const off = discountPercent(price, oldPrice);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span
        className={cn(
          "font-heading font-bold tabular-nums text-foreground",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-2xl",
        )}
      >
        {formatPrice(price)}
      </span>
      {oldPrice && (
        <span className="text-xs text-muted-foreground line-through tabular-nums">
          {formatPrice(oldPrice)}
        </span>
      )}
      {off && (
        <span className="text-xs font-semibold text-deal-ink tabular-nums">
          -{off}%
        </span>
      )}
    </div>
  );
}
