import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { requireAdmin } from "../auth";
import { ApiError } from "../api-helpers";
import type { LegacyTransaction } from "../store-client";

export async function adminStoreId() {
  await requireAdmin();
  return (await getStoreContext()).id;
}

export async function requireCategory(slug: string, storeId: string, client: LegacyTransaction = prisma) {
  if (!await client.category.findUnique({ where: { storeId_slug: { storeId, slug } }, select: { slug: true } })) {
    throw new ApiError(404, "Categoría no encontrada");
  }
}

export async function requireSection(id: string, storeId: string, client: LegacyTransaction = prisma) {
  if (!await client.homeSection.findUnique({ where: { id, storeId }, select: { id: true } })) throw new ApiError(404, "Sección no encontrada");
}

/** Filtros opcionales del CSV; cada ID se comprueba antes de generar datos. */
export async function adminExportSelection(request: Request, resource: "orders" | "payments") {
  const storeId = await adminStoreId();
  const query = new URL(request.url).searchParams;
  for (const key of ["storeId", "tenantId"]) {
    if (query.getAll(key).some((value) => value !== storeId)) throw new ApiError(403, "La exportación pertenece a otra tienda");
  }
  const names = resource === "orders" ? ["id", "ids", "orderId"] : ["id", "ids", "paymentId"];
  const provided = names.some((name) => query.has(name));
  const ids = [...new Set(names.flatMap((name) => query.getAll(name)).flatMap((value) => value.split(",")).filter(Boolean))];
  if (provided && (!ids.length || ids.length > 1000)) throw new ApiError(400, "Selección de exportación inválida");
  if (ids.length) {
    const count = resource === "orders"
      ? await prisma.order.count({ where: { storeId, id: { in: ids } } })
      : await prisma.payment.count({ where: { storeId, id: { in: ids } } });
    if (count !== ids.length) throw new ApiError(404, "Recurso de exportación no encontrado");
  }
  const orderId = resource === "payments" ? query.get("orderId") : null;
  if (orderId !== null && !await prisma.order.findUnique({ where: { id: orderId, storeId }, select: { id: true } })) throw new ApiError(404, "Pedido no encontrado");
  return { ids: provided ? ids : undefined, orderId: orderId ?? undefined };
}
