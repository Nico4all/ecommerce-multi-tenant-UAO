import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-muted-foreground">{label}</span>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      {/* Los montos en COP son largos ($54.518.851): en las tarjetas angostas
          del móvil se encogen para no desbordar, y crecen en pantallas grandes. */}
      <p className="mt-2 truncate font-heading text-lg font-bold tabular-nums sm:text-xl xl:text-2xl">
        {value}
      </p>
      {delta !== undefined && (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            positive ? "text-success" : "text-destructive",
          )}
        >
          {positive ? (
            <TrendingUp className="size-3.5" />
          ) : (
            <TrendingDown className="size-3.5" />
          )}
          {positive ? "+" : ""}
          {delta}%
          <span className="font-normal text-muted-foreground">vs. mes anterior</span>
        </p>
      )}
    </div>
  );
}
