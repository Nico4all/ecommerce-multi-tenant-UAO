import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { requireAdmin } from "../auth";

export interface AdminStats {
  revenue: number;
  /**
   * Ganancia = suma de (precio de venta − costo) × cantidad, sobre los artículos
   * vendidos (pedidos no cancelados) que tienen costo registrado. Es la ganancia
   * "sin contar la inversión": lo que queda después de descontar lo que costó el
   * producto. No resta envío ni códigos de descuento a nivel pedido.
   */
  profit: number;
  /** Productos publicados sin costo cargado (su ganancia no se puede calcular). */
  productsWithoutCost: number;
  ordersCount: number;
  customersCount: number;
  avgOrder: number;
  /** Pedidos por día, últimos 12 días (para el mini-gráfico). */
  salesSeries: { label: string; value: number }[];
  topCategories: { slug: string; name: string; count: number }[];
  recentOrders: {
    id: string;
    code: string;
    userName: string;
    date: string;
    status: string;
    total: number;
  }[];
}

export async function getAdminStats(): Promise<AdminStats> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();

  const [revenueAgg, ordersCount, customersCount, categories, recent] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { not: "CANCELLED" } },
      }),
      prisma.order.count(),
      prisma.storeMembership.count({ where: { storeId, role: "CUSTOMER" } }),
      prisma.category.findMany({
        include: { _count: { select: { products: true } } },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 7,
        include: { user: { select: { name: true } } },
      }),
    ]);

  const revenue = Number(revenueAgg._sum.total ?? 0);
  const validOrders = await prisma.order.count({
    where: { status: { not: "CANCELLED" } },
  });
  const avgOrder = validOrders > 0 ? revenue / validOrders : 0;

  // Ganancia: margen de los artículos vendidos con costo registrado.
  const [soldItems, productsWithoutCost] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { status: { not: "CANCELLED" } }, unitCost: { not: null } },
      select: { unitPrice: true, unitCost: true, qty: true },
    }),
    prisma.product.count({ where: { status: "PUBLISHED", cost: null } }),
  ]);
  const profit = soldItems.reduce(
    (s, i) => s + (Number(i.unitPrice) - Number(i.unitCost!)) * i.qty,
    0,
  );

  // Serie de los últimos 12 días (conteo de pedidos por día).
  const since = new Date();
  since.setDate(since.getDate() - 11);
  since.setHours(0, 0, 0, 0);
  const recentAll = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const salesSeries: { label: string; value: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const day = new Date(since);
    day.setDate(since.getDate() + i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    salesSeries.push({
      label: day.toLocaleDateString("es-CO", { weekday: "narrow" }),
      value: recentAll.filter((o) => o.createdAt >= day && o.createdAt < next)
        .length,
    });
  }

  return {
    revenue,
    profit,
    productsWithoutCost,
    ordersCount,
    customersCount,
    avgOrder,
    salesSeries,
    topCategories: categories
      .map((c) => ({ slug: c.slug, name: c.name, count: c._count.products }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    recentOrders: recent.map((o) => ({
      id: o.id,
      code: o.code,
      userName: o.user?.name ?? o.shippingName,
      date: o.createdAt.toISOString().slice(0, 10),
      status: o.status,
      total: Number(o.total),
    })),
  };
}
