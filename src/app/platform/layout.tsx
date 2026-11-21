import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Administración de plataforma", applicationName: "Plataforma multitienda",
  robots: { index: false, follow: false }, alternates: { canonical: null },
  openGraph: { title: "Administración de plataforma", siteName: "Plataforma multitienda", images: [] },
  twitter: { title: "Administración de plataforma", images: [] },
};

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePlatformAdmin();
  return (
    <div className="min-h-dvh bg-background">
      <div aria-hidden className="h-1 bg-brand" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/platform" className="flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 aria-hidden className="size-6" /></span>
            <span className="font-heading text-sm font-bold sm:text-lg">Administración de plataforma</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2"><span className="hidden text-sm text-muted-foreground sm:block">{session.name}</span><ThemeToggle /></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
