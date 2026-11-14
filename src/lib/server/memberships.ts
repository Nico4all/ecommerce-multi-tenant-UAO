import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { ApiError } from "./api-helpers";
import type { LegacyTransaction } from "./store-client";

export const publicStoreRole = (role: string): "ADMIN" | "CUSTOMER" =>
  role === "OWNER" || role === "ADMIN" ? "ADMIN" : "CUSTOMER";

/** Solo un login autenticado puede incorporar al usuario como cliente; nunca promoverlo. */
export async function ensureCustomerMembership(userId: string, transaction?: LegacyTransaction) {
  const { id: storeId } = await getStoreContext();
  const client = transaction ?? prisma;
  const membership = await client.storeMembership.upsert({
    where: { storeId_userId: { storeId, userId } }, update: {}, create: { storeId, userId, role: "CUSTOMER" },
  });
  if (!membership.active) throw new ApiError(403, "Tu acceso a esta tienda está suspendido");
  return membership;
}
