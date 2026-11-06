import Link from "next/link";
import { LogoImage } from "@/components/layout/logo";
import { AdminNav } from "@/components/admin/admin-nav";

export function AdminSidebar({ newSupportCount }: { newSupportCount: number }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-card lg:flex lg:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Link
          href="/admin"
          aria-label="Panel admin — Variedades Los Primos"
          className="flex min-w-0 flex-col justify-center gap-0.5"
        >
          <LogoImage className="h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Panel admin
          </span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <AdminNav newSupportCount={newSupportCount} />
      </div>
    </aside>
  );
}
