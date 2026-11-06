import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { getProfile } from "@/lib/server/account";
import { ProfileForm } from "@/components/account/profile-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const metadata: Metadata = {
  title: "Mi cuenta — Variedades Los Primos",
};

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/cuenta");

  const profile = await getProfile(session.id);
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Mi cuenta
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Actualiza tus datos y tu contraseña.
      </p>

      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-4 font-heading font-semibold">Datos personales</h2>
          <ProfileForm profile={profile} />
        </section>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-1 font-heading font-semibold">Contraseña</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {profile.hasPassword
              ? "Cambia tu contraseña cuando quieras."
              : "Tu cuenta todavía no tiene contraseña. Fija una para entrar con tu correo."}
          </p>
          <ChangePasswordForm hasPassword={profile.hasPassword} />
        </section>
      </div>
    </div>
  );
}
