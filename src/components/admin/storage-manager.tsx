"use client";

import * as React from "react";
import { HardDrive, Loader2, Trash2, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/image-limits";
import { api, ApiClientError } from "@/lib/api-client";
import type { SweepReport } from "@/lib/server/admin/uploads-gc";

const GC_URL = "/api/admin/uploads/gc";

export function StorageManager() {
  const [report, setReport] = React.useState<SweepReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [purging, setPurging] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const analyze = React.useCallback(async () => {
    setLoading(true);
    setConfirming(false);
    try {
      setReport(await api.post<SweepReport>(`${GC_URL}?dryRun=1`));
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo analizar el almacenamiento",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Al abrir la página se muestra el estado actual sin tocar nada (dry-run).
  React.useEffect(() => {
    void analyze();
  }, [analyze]);

  const purge = async () => {
    setPurging(true);
    try {
      const res = await api.post<SweepReport>(GC_URL);
      toast.success(
        res.deleted > 0
          ? `Se eliminaron ${res.deleted} imagen(es) huérfana(s) · ${formatBytes(res.bytes)} liberados`
          : "No había imágenes huérfanas que eliminar",
      );
      await analyze(); // refresca el conteo (debería quedar en 0)
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo limpiar el almacenamiento",
      );
    } finally {
      setPurging(false);
      setConfirming(false);
    }
  };

  const orphans = report?.orphans ?? 0;
  const busy = loading || purging;

  return (
    <div className="max-w-2xl rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <HardDrive className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-semibold">Imágenes huérfanas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Archivos que quedaron en el almacén al reemplazar o borrar fotos de
            productos, categorías, banners y secciones. Ya no los usa nadie, así
            que se pueden eliminar sin afectar la tienda.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-background p-4">
        {loading && !report ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Analizando el almacenamiento…
          </div>
        ) : report ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Archivos totales" value={String(report.scanned)} />
            <Stat label="En uso" value={String(report.referenced)} />
            <Stat
              label="Huérfanos"
              value={String(orphans)}
              hint={orphans > 0 ? formatBytes(report.bytes) : undefined}
              highlight={orphans > 0}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="lg" onClick={analyze} disabled={busy}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Analizar
        </Button>

        {orphans > 0 &&
          (confirming ? (
            <>
              <Button
                variant="destructive"
                size="lg"
                onClick={purge}
                disabled={purging}
              >
                {purging ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Confirmar eliminación de {orphans}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setConfirming(false)}
                disabled={purging}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              size="lg"
              onClick={() => setConfirming(true)}
              disabled={busy}
            >
              <Trash2 />
              Eliminar {orphans} huérfano(s)
            </Button>
          ))}

        {report && orphans === 0 && !loading && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            Todo limpio
          </span>
        )}
      </div>

      {report && report.sample.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Ver archivos huérfanos ({report.sample.length}
            {report.orphans > report.sample.length ? "+" : ""})
          </summary>
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border bg-background p-2 font-mono text-xs text-muted-foreground">
            {report.sample.map((key) => (
              <li key={key} className="truncate py-0.5">
                {key}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className={
          "font-heading text-2xl font-bold tabular-nums " +
          (highlight ? "text-deal" : "")
        }
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
