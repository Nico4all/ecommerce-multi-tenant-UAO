import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { getSession } from "@/lib/server/auth";
import { countNewSupportMessages } from "@/lib/server/support";
import { getNotificationFeed } from "@/lib/server/notifications";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Panel de administración — ${SITE_NAME}`,
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
    <div className="min-h-dvh bg-background">
      {/* Primero en el DOM a propósito: el panel tiene doce secciones en la
          barra lateral y, sin esto, llegar al contenido con el tabulador
          costaba trece pulsaciones en cada pantalla. */}
      <a
        href="#contenido-admin"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Saltar al contenido
      </a>

      <AdminSidebar newSupportCount={newSupportCount} />
      <div className="lg:pl-60">
        {/* El remate rojo con el que abren la tienda y las pantallas de
            acceso. Aquí corona la columna de contenido, porque la barra
            lateral ocupa el borde izquierdo. */}
        <span aria-hidden className="block h-1 w-full bg-brand" />
        <AdminHeader
          adminName={session?.name ?? "Admin"}
          newSupportCount={newSupportCount}
          notifications={notifications}
        />
        <main id="contenido-admin" className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
