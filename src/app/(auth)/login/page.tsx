"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api, ApiClientError } from "@/lib/api-client";

interface SessionUser {
  id: string;
  name: string;
  role: "ADMIN" | "CUSTOMER";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [show, setShow] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await api.post<SessionUser>("/api/auth/login", {
        email,
        password,
      });
      toast.success(`¡Hola de nuevo, ${user.name.split(" ")[0]}!`);
      const next = searchParams.get("next");
      router.push(next ?? (user.role === "ADMIN" ? "/admin" : "/"));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "No se pudo iniciar sesión",
      );
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Iniciar sesión
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bienvenido de vuelta a Variedades Los Primos
          </p>
        </div>

        {/* Aviso al llegar desde el checkout: por qué se pide la cuenta. */}
        {next === "/checkout" && !error && (
          <p className="mb-4 flex items-start gap-2 rounded-md bg-primary/10 p-2.5 text-sm text-foreground">
            <ShoppingBag className="mt-0.5 size-4 shrink-0 text-primary" />
            Inicia sesión para completar tu compra: así podrás ver y rastrear tus
            pedidos. Tu carrito se conserva.
          </p>
        )}

        <form className="space-y-4" onSubmit={onSubmit}>
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="h-11 pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link href="/forgot" className="text-xs font-medium text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 px-9"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox id="remember" />
            <span>Recordarme</span>
          </label>

          <Button type="submit" disabled={loading} className="h-11 w-full gap-2 text-base">
            {loading ? (
              <>
                <Loader2 className="size-5 animate-spin" /> Entrando…
              </>
            ) : (
              <>
                Iniciar sesión
                <ArrowRight className="size-5" />
              </>
            )}
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-primary hover:underline"
        >
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}
