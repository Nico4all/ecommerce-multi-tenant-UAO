import { PageHeading } from "@/components/admin/page-heading";
import { OrdersTable } from "@/components/admin/orders-table";
import { AutoRefresh } from "@/components/auto-refresh";
import { listAdminOrders } from "@/lib/server/admin/orders";

export default async function AdminOrdersPage() {
  const orders = await listAdminOrders();
  const pending = orders.filter(
    (o) => o.status === "PENDING" || o.status === "PAID" || o.status === "PACKING",
  ).length;

  return (
    <div>
      {/* Un pedido nuevo aparece solo, sin refrescar ni perder los filtros. */}
      <AutoRefresh seconds={20} />
      <PageHeading
        title="Pedidos"
        description={`${orders.length} pedidos · ${pending} por preparar`}
      />
      <OrdersTable orders={orders} />
    </div>
  );
}
