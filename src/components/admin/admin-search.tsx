"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Package, ClipboardList, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

interface Results {
  products: { id: string; name: string; brand: string }[];
  orders: { id: string; code: string; name: string }[];
  users: { id: string; name: string; email: string }[];
}

const EMPTY: Results = { products: [], orders: [], users: [] };

/** Buscador global del panel: productos, pedidos y usuarios con acceso rápido. */
export function AdminSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Results>(EMPTY);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        setResults(
          await api.get<Results>(`/api/admin/search?q=${encodeURIComponent(term)}`),
        );
      } catch {
        setResults(EMPTY);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const count =
    results.products.length + results.orders.length + results.users.length;
  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Buscar productos, pedidos o usuarios…"
          className="h-full flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {loading && count === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Buscando…
            </div>
          ) : count > 0 ? (
            <div className="max-h-[70vh] overflow-y-auto py-1">
              <Group label="Productos">
                {results.products.map((p) => (
                  <Row
                    key={p.id}
                    icon={<Package className="size-4" />}
                    title={p.name}
                    subtitle={p.brand}
                    onClick={() => go(`/admin/products/${p.id}`)}
                  />
                ))}
              </Group>
              <Group label="Pedidos">
                {results.orders.map((o) => (
                  <Row
                    key={o.id}
                    icon={<ClipboardList className="size-4" />}
                    title={o.code}
                    subtitle={o.name}
                    onClick={() => go(`/admin/orders/${o.id}`)}
                  />
                ))}
              </Group>
              <Group label="Usuarios">
                {results.users.map((u) => (
                  <Row
                    key={u.id}
                    icon={<User className="size-4" />}
                    title={u.name}
                    subtitle={u.email}
                    onClick={() => go(`/admin/users/${u.id}`)}
                  />
                ))}
              </Group>
            </div>
          ) : (
            <div className="px-4 py-4 text-sm text-muted-foreground">
              Sin coincidencias para &ldquo;{q.trim()}&rdquo;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode[];
}) {
  if (children.length === 0) return null;
  return (
    <div className="py-1">
      <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-sm font-medium">{title}</span>
        <span className="line-clamp-1 text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}
