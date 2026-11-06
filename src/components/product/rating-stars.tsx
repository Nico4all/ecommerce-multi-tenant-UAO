import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";

export function RatingStars({
  rating,
  reviews,
  className,
}: {
  rating: number;
  reviews?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div
        className="flex items-center"
        role="img"
        aria-label={`Calificación ${rating} de 5`}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i + 1 <= Math.round(rating);
          return (
            <Star
              key={i}
              className={cn(
                "size-3.5",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-muted text-muted-foreground/40",
              )}
            />
          );
        })}
      </div>
      {reviews !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">
          ({formatCount(reviews)})
        </span>
      )}
    </div>
  );
}
