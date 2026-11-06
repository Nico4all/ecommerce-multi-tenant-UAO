import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { getSession } from "@/lib/server/auth";
import { countNewSupportMessages } from "@/lib/server/support";
import { getNotificationFeed } from "@/lib/server/notifications";

export const metadata: Metadata = {
  title: "Panel de administración — Variedades Los Primos",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // El proxy ya validó rol ADMIN; aquí solo leemos el nombre para el header.
  const [session, newSupportCount, notifications] = await Promise.all([
    getSession(),
    countNewSupportMessages(),
    getNotificationFeed(),
  ]);

  return (
    <div className="min-h-dvh bg-muted/30">
      <AdminSidebar newSupportCount={newSupportCount} />
      <div className="lg:pl-60">
        <AdminHeader
          adminName={session?.name ?? "Admin"}
          newSupportCount={newSupportCount}
          notifications={notifications}
        />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
