import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  // Pedidos
  pendiente: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  pagado: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  empacando: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  enviado: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  en_camino: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  entregado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelado: "bg-red-500/15 text-red-700 dark:text-red-400",
  // Pagos
  completado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  reembolsado: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  fallido: "bg-red-500/15 text-red-700 dark:text-red-400",
  // Genéricos
  activo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  inactivo: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  programado: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  expirado: "bg-red-500/15 text-red-700 dark:text-red-400",
  publicado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  borrador: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  agotado: "bg-red-500/15 text-red-700 dark:text-red-400",
  // PQR y contacto
  nuevo: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  en_proceso: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  resuelto: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cerrado: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

const labels: Record<string, string> = {
  en_camino: "en camino",
  en_proceso: "en proceso",
};

export function StatusBadge({ status }: { status: string }) {
  // Solo la primera letra en alta. Antes era `capitalize`, que ponía en alta
  // cada palabra y dejaba "En Camino"; y `first-letter:uppercase` tampoco
  // sirve aquí, porque ::first-letter no aplica a un contenedor flex.
  const text = labels[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        styles[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {text.charAt(0).toUpperCase() + text.slice(1)}
    </span>
  );
}
