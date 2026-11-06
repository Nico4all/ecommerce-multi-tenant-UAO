"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api, ApiClientError } from "@/lib/api-client";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [show, setShow] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [terms, setTerms] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!terms) {
      setError("Debes aceptar los Términos y la Política de privacidad");
      return;
    }
    setLoading(true);
    try {
      const user = await api.post<{ name: string }>("/api/auth/register", {
        name,
        email,
        password,
        acceptedTerms: terms,
      });
      toast.success(`¡Bienvenido, ${user.name.split(" ")[0]}! Tu cuenta está lista.`);
      // Si venía del checkout, de vuelta a terminar la compra.
      router.push(next ?? "/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "No se pudo crear la cuenta",
      );
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Crear cuenta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Únete a Variedades Los Primos en segundos
          </p>
        </div>

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
            <Label htmlFor="name">Nombre completo</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="h-11 pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="h-11 pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
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

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              id="terms"
              checked={terms}
              onCheckedChange={(v) => setTerms(v === true)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              Acepto los{" "}
              <Link href="/terminos" target="_blank" className="text-primary hover:underline">
                Términos
              </Link>{" "}
              y la{" "}
              <Link
                href="/datos-personales"
                target="_blank"
                className="text-primary hover:underline"
              >
                Política de datos personales
              </Link>
            </span>
          </label>

          <Button type="submit" disabled={loading} className="h-11 w-full gap-2 text-base">
            {loading ? (
              <>
                <Loader2 className="size-5 animate-spin" /> Creando cuenta…
              </>
            ) : (
              <>
                Crear cuenta
                <ArrowRight className="size-5" />
              </>
            )}
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-primary hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  // useSearchParams exige un límite de Suspense para el prerender.
  return (
    <React.Suspense fallback={null}>
      <RegisterForm />
    </React.Suspense>
  );
}
