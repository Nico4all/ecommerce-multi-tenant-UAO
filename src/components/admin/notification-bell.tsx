"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ClipboardList,
  MessageSquare,
  Star,
  PackageX,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import type {
  NotificationDTO,
  NotificationFeed,
  NotificationType,
} from "@/lib/server/notifications";

const ICON: Record<NotificationType, typeof Bell> = {
  ORDER_CREATED: ClipboardList,
  SUPPORT_MESSAGE: MessageSquare,
  REVIEW_CREATED: Star,
  LOW_STOCK: PackageX,
};

const TONE: Record<NotificationType, string> = {
  ORDER_CREATED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  SUPPORT_MESSAGE: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  REVIEW_CREATED: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  LOW_STOCK: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const rtf = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" });

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

/** Refresco del feed mientras el panel está abierto. */
const POLL_MS = 15_000;

/**
 * Campana del panel.
 *
 * Arranca con el feed que ya trae el servidor (sin parpadeo) y desde ahí se
 * refresca sola cada minuto y cada vez que se abre.
 */
export function NotificationBell({ initial }: { initial: NotificationFeed }) {
  const router = useRouter();
  const [feed, setFeed] = React.useState<NotificationFeed>(initial);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // El servidor manda: si el layout se revalida, el feed inicial es la verdad.
  React.useEffect(() => setFeed(initial), [initial]);

  const refetch = React.useCallback(async () => {
    try {
      setFeed(await api.get<NotificationFeed>("/api/admin/notifications"));
    } catch {
      // Un fallo de refresco no merece molestar: se reintenta al siguiente ciclo.
    }
  }, []);

  React.useEffect(() => {
    const id = setInterval(refetch, POLL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  const openChange = (v: boolean) => {
    setOpen(v);
    if (v) void refetch();
  };

  const openItem = async (n: NotificationDTO) => {
    setOpen(false);
    if (!n.read) {
      // Optimista: el aviso se apaga ya, sin esperar al servidor.
      setFeed((f) => ({
        items: f.items.map((i) => (i.id === n.id ? { ...i, read: true } : i)),
        unread: Math.max(0, f.unread - 1),
      }));
      try {
        await api.patch(`/api/admin/notifications/${n.id}`);
      } catch {
        void refetch();
      }
    }
    if (n.href) router.push(n.href);
    router.refresh();
  };

  const markAll = async () => {
    setBusy(true);
    try {
      const { count } = await api.post<{ count: number }>(
        "/api/admin/notifications/read-all",
      );
      setFeed((f) => ({
        items: f.items.map((i) => ({ ...i, read: true })),
        unread: 0,
      }));
      toast.success(
        count === 0 ? "No había avisos pendientes" : `${count} aviso(s) marcados`,
      );
      router.refresh();
    } catch {
      toast.error("No se pudieron marcar como leídos");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={openChange}>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
        aria-label={
          feed.unread > 0 ? `${feed.unread} aviso(s) sin leer` : "Notificaciones"
        }
      >
        <Bell className="size-5" />
        {feed.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-deal px-1 text-[10px] font-bold leading-4 text-deal-foreground">
            {feed.unread > 9 ? "9+" : feed.unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          {feed.unread > 0 && (
            <button
              onClick={markAll}
              disabled={busy}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCheck className="size-3" />
              )}
              Marcar todas
            </button>
          )}
        </div>

        {feed.items.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <Bell className="mx-auto size-8 text-muted-foreground/40" strokeWidth={1.25} />
            <p className="mt-2 text-sm text-muted-foreground">
              Aquí verás las ventas, las PQR y los avisos de stock.
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {feed.items.map((n) => {
              const Icon = ICON[n.type];
              return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-accent",
                    !n.read && "bg-primary/[0.04]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                      TONE[n.type],
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-1.5">
                      <span
                        className={cn(
                          "block flex-1 text-sm leading-snug",
                          n.read ? "text-muted-foreground" : "font-medium",
                        )}
                      >
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
