import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAdminOrder } from "@/lib/server/admin/orders";
import { OrderManage } from "@/components/admin/order-manage";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/orders"
          aria-label="Volver"
          className="grid size-9 place-items-center rounded-md border border-border hover:bg-accent"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            Pedido {order.code}
          </h1>
          <p className="text-sm text-muted-foreground">
            Cliente: {order.customer.name}
          </p>
        </div>
      </div>

      <OrderManage order={order} />
    </div>
  );
}
