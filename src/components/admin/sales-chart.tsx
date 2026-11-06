/** Mini gráfico de barras (SVG/CSS) para ventas recientes. Sin librerías. */
export function SalesChart({
  series,
}: {
  series: { label: string; value: number }[];
}) {
  const max = Math.max(...series.map((s) => s.value), 1);

  return (
    <div className="flex h-40 items-end gap-2">
      {series.map((s, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
              style={{ height: `${(s.value / max) * 100}%` }}
              title={`${s.value} pedidos`}
            />
          </div>
          <span className="text-[10px] uppercase text-muted-foreground">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
