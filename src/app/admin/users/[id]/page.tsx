import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShoppingBag,
  Wallet,
  Truck,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/status-badge";
import { UserFormDialog } from "@/components/admin/user-form-dialog";
import { AdminResetPassword } from "@/components/admin/admin-reset-password";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { getAdminUser } from "@/lib/server/admin/users";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("");
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAdminUser(id);
  if (!user) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/users"
          aria-label="Volver"
          className="grid size-9 place-items-center rounded-md border border-border hover:bg-accent"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary/15 font-bold text-primary">
            {initials(user.name)}
          </span>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight">
              {user.name}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Cliente desde {user.joinedAt}
              <StatusBadge status={user.status === "ACTIVE" ? "activo" : "inactivo"} />
            </div>
          </div>
        </div>
        <div className="ml-auto">
          <UserFormDialog mode="edit" user={user} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Columna izquierda: contacto + envío */}
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-heading font-semibold">Contacto</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 size-4 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 size-4 text-muted-foreground" />
                <span>{user.phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 size-4 text-muted-foreground" />
                <span>Registrado el {user.joinedAt}</span>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
              <Truck className="size-4 text-primary" />
              Dirección de envío
            </h2>
            {user.address ? (
              <address className="space-y-0.5 text-sm not-italic text-muted-foreground">
                <p className="font-medium text-foreground">{user.name}</p>
                <p>{user.address.street}</p>
                <p>
                  {user.address.city}, {user.address.state} {user.address.zip}
                </p>
                <p>{user.address.country}</p>
                <p className="flex items-center gap-1.5 pt-1">
                  <Phone className="size-3.5" />
                  {user.phone}
                </p>
              </address>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin dirección registrada. Usa &ldquo;Editar&rdquo; para añadirla.
              </p>
            )}
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
              Esta es la dirección predeterminada para el envío de sus pedidos.
            </div>
          </section>

          <AdminResetPassword userId={user.id} userName={user.name} />
        </div>

        {/* Columna derecha: stats + pedidos */}
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShoppingBag className="size-4 text-primary" />
                Pedidos totales
              </div>
              <p className="mt-2 font-heading text-2xl font-bold tabular-nums">
                {user.orders}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="size-4 text-primary" />
                Total gastado
              </div>
              <p className="mt-2 font-heading text-2xl font-bold tabular-nums">
                {formatPrice(user.totalSpent)}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-border bg-card">
            <h2 className="p-5 pb-3 font-heading font-semibold">
              Historial de pedidos
            </h2>
            <div className="overflow-x-auto border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Artículos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.recentOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="hover:text-primary"
                        >
                          {o.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{o.date}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.items}</TableCell>
                      <TableCell>
                        <StatusBadge status={ORDER_STATUS_LABEL[o.status] ?? o.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(o.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {user.recentOrders.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Sin pedidos registrados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
