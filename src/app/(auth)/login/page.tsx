"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthError, AuthHeading } from "@/components/auth/auth-card";
import { PasswordField } from "@/components/auth/password-field";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { DEFAULT_STORE_BRAND } from "@/components/layout/store-brand";
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
    <AuthCard
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link
            href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="rounded-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      <AuthHeading
        title="Iniciar sesión"
        description={`Bienvenido de vuelta a ${DEFAULT_STORE_BRAND.name}`}
      />

      {/* Aviso al llegar desde el checkout: por qué se pide la cuenta. */}
      {next === "/checkout" && !error && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-brand-soft p-2.5 text-sm text-foreground">
          <ShoppingBag aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          Inicia sesión para completar tu compra: así podrás ver y rastrear tus
          pedidos. Tu carrito se conserva.
        </p>
      )}

      {/* Sin ruta OAuth en el proyecto esto no pinta nada. Ver el componente. */}
      <GoogleSignIn next={next} />

      <form className="space-y-4" onSubmit={onSubmit}>
        {error && <AuthError>{error}</AuthError>}

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <div className="relative">
            <Mail
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
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
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              href="/forgot"
              className="rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <PasswordField
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

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

        {/* Sustituye a la casilla "Recordarme", que no se enviaba a ninguna
            parte: el esquema de /api/auth/login es {email, password} y la
            sesión dura lo mismo se marcara o no. Esto dice lo que de verdad
            pasa, sin prometer un ajuste que no existe. */}
        <p className="text-xs text-muted-foreground">
          Tu sesión queda abierta en este dispositivo. Si lo compartes, cierra
          sesión desde tu cuenta al terminar.
        </p>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}
