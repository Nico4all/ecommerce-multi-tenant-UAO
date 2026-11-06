import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          aria-label="Variedades Los Primos - Inicio"
          className="flex items-center gap-2 font-heading font-extrabold"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Store className="size-5" strokeWidth={2.25} />
          </span>
          <span className="flex flex-col justify-center leading-none">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Variedades
            </span>
            <span className="text-lg text-foreground">
              Los <span className="text-primary">Primos</span>
            </span>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>

      <footer className="p-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Variedades Los Primos · Compra protegida
      </footer>
    </div>
  );
}
