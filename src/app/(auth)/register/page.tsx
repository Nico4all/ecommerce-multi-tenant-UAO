"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Mail, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthCard, AuthError, AuthHeading } from "@/components/auth/auth-card";
import { PasswordField } from "@/components/auth/password-field";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { DEFAULT_STORE_BRAND } from "@/components/layout/store-brand";
import { api, ApiClientError } from "@/lib/api-client";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
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
    <AuthCard
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="rounded-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Iniciar sesión
          </Link>
        </>
      }
    >
      <AuthHeading
        title="Crear cuenta"
        description={`Únete a ${DEFAULT_STORE_BRAND.name} en segundos`}
      />

      {/* Sin ruta OAuth en el proyecto esto no pinta nada. Ver el componente. */}
      <GoogleSignIn next={next} label="Registrarme con Google" />

      <form className="space-y-4" onSubmit={onSubmit}>
        {error && <AuthError>{error}</AuthError>}

        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre completo</Label>
          <div className="relative">
            <User
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
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
            <Mail
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
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
          {/* El mínimo ya se anunciaba en el texto de ayuda pero no se
              comprobaba hasta llegar al servidor: el cliente escribía cuatro
              letras, enviaba y recibía un error. `minLength` lo avisa antes.
              El servidor sigue revalidando por su cuenta. */}
          <PasswordField
            id="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            Mínimo 8 caracteres.
          </p>
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
            <Link
              href="/terminos"
              target="_blank"
              className="rounded-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Términos
            </Link>{" "}
            y la{" "}
            <Link
              href="/datos-personales"
              target="_blank"
              className="rounded-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
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
    </AuthCard>
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
