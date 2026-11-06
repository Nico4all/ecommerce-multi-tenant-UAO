import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeading } from "@/components/admin/page-heading";
import { NewUserForm } from "@/components/admin/new-user-form";

export default function NewUserPage() {
  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Usuarios
        </Link>
      </div>
      <PageHeading
        title="Nuevo usuario"
        description="Crea un cliente o un administrador con sus credenciales"
      />
      <NewUserForm />
    </div>
  );
}
