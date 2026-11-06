import { redirect } from "next/navigation";
import { Mail, Shield } from "lucide-react";
import { PageHeading } from "@/components/admin/page-heading";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { getSession } from "@/lib/server/auth";
import { getProfile } from "@/lib/server/account";

export default async function AdminProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/perfil");

  const profile = await getProfile(session.id);
  if (!profile) redirect("/login");

  return (
    <div className="max-w-2xl">
      <PageHeading title="Mi perfil" description="Tu cuenta de administrador" />

      <section className="mb-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-lg font-bold text-primary">
            {profile.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="font-heading font-semibold">{profile.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {profile.email}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-primary">
                <Shield className="size-3.5" />
                Administrador
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 font-heading font-semibold">Cambiar contraseña</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {profile.hasPassword
            ? "Ingresa tu contraseña actual y la nueva."
            : "Fija una contraseña para tu cuenta."}
        </p>
        <ChangePasswordForm hasPassword={profile.hasPassword} />
      </section>
    </div>
  );
}
