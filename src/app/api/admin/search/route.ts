import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { requireAdmin } from "@/lib/server/auth";
import { prisma, getStoreContext } from "@/lib/prisma";

/**
 * Búsqueda global del panel (barra del header). Devuelve pocas coincidencias de
 * productos, pedidos y usuarios para el desplegable de acceso rápido. Solo admin.
 */
export const GET = withErrorHandling(async (req: Request) => {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return jsonOk({ products: [], orders: [], users: [] });

  // Sin `mode: "insensitive"`: solo existe en PostgreSQL. Con MariaDB la
  // colación utf8mb4_unicode_ci ya compara sin distinguir mayúsculas.
  const like = { contains: q };
  const [products, orders, users] = await Promise.all([
    prisma.product.findMany({
      where: { OR: [{ name: like }, { brand: like }, { sku: like }] },
      take: 5,
      select: { id: true, name: true, brand: true },
    }),
    prisma.order.findMany({
      where: { OR: [{ code: like }, { shippingName: like }, { email: like }] },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, shippingName: true },
    }),
    prisma.user.findMany({
      where: { memberships: { some: { storeId } }, OR: [{ name: like }, { email: like }] },
      take: 5,
      select: { id: true, name: true, email: true },
    }),
  ]);

  return jsonOk({
    products: products.map((p) => ({ id: p.id, name: p.name, brand: p.brand })),
    orders: orders.map((o) => ({ id: o.id, code: o.code, name: o.shippingName })),
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
  });
});
