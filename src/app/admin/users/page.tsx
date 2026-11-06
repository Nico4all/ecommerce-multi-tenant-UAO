import Link from "next/link";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeading } from "@/components/admin/page-heading";
import { UsersTable } from "@/components/admin/users-table";
import { listAdminUsers } from "@/lib/server/admin/users";

export default async function AdminUsersPage() {
  const users = await listAdminUsers();
  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div>
      <PageHeading
        title="Usuarios"
        description={`${users.length} registrados · ${adminCount} administrador(es)`}
      >
        <Link
          href="/admin/users/nuevo"
          className={cn(buttonVariants({ size: "default" }), "h-9 gap-2")}
        >
          <UserPlus className="size-4" />
          Nuevo usuario
        </Link>
      </PageHeading>

      <UsersTable users={users} />
    </div>
  );
}
