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
        {/* La estrella llena iba en ámbar de Tailwind: 1.67:1 sobre blanco
            y 1.54:1 sobre crema, cuando 1.4.11 pide 3:1 para un gráfico que
            transmite información. Pasa a la tinta del acento naranja del
            manual: 5.15:1 sobre blanco, 4.75:1 sobre crema y 8.87:1 en modo
            oscuro, donde la tinta vuelve a ser el acento. */}
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i + 1 <= Math.round(rating);
          return (
            <Star
              key={i}
              aria-hidden
              className={cn(
                "size-3.5",
                filled
                  ? "fill-deal-ink text-deal-ink"
                  : "fill-muted text-muted-foreground/60",
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
