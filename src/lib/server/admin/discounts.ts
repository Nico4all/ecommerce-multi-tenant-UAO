import { ORIGINAL_STORE_ID } from "../../../../prisma/stores";
import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../auth";
import { ApiError } from "../api-helpers";

export interface AdminDiscountRow {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING" | "GIFT_CARD";
  value: number;
  minPurchase: number | null;
  usedCount: number;
  usageLimit: number | null;
  balance: number | null;
  status: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED";
  startsAt: string | null;
  expiresAt: string | null;
  description: string | null;
}

export interface DiscountInput {
  code: string;
  type: AdminDiscountRow["type"];
  value?: number;
  minPurchase?: number | null;
  usageLimit?: number | null;
  status?: AdminDiscountRow["status"];
  startsAt?: string | null; // ISO date
  expiresAt?: string | null;
  description?: string | null;
}

function toRow(d: {
  id: string;
  code: string;
  type: string;
  value: unknown;
  minPurchase: unknown | null;
  usedCount: number;
  usageLimit: number | null;
  balance: unknown | null;
  status: string;
  startsAt: Date | null;
  expiresAt: Date | null;
  description: string | null;
}): AdminDiscountRow {
  return {
    id: d.id,
    code: d.code,
    type: d.type as AdminDiscountRow["type"],
    value: Number(d.value),
    minPurchase: d.minPurchase === null ? null : Number(d.minPurchase),
    usedCount: d.usedCount,
    usageLimit: d.usageLimit,
    balance: d.balance === null ? null : Number(d.balance),
    status: d.status as AdminDiscountRow["status"],
    startsAt: d.startsAt?.toISOString().slice(0, 10) ?? null,
    expiresAt: d.expiresAt?.toISOString().slice(0, 10) ?? null,
    description: d.description,
  };
}

function toData(input: DiscountInput) {
  return {
    code: input.code.trim().toUpperCase(),
    type: input.type,
    value: input.type === "FREE_SHIPPING" ? 0 : (input.value ?? 0),
    minPurchase: input.minPurchase ?? null,
    usageLimit: input.usageLimit ?? null,
    balance: input.type === "GIFT_CARD" ? (input.value ?? 0) : null,
    status: input.status ?? "ACTIVE",
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    description: input.description ?? null,
  };
}

export async function listAdminDiscounts(): Promise<AdminDiscountRow[]> {
  await requireAdmin();
  const rows = await prisma.discountCode.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRow);
}

export async function createDiscount(input: DiscountInput): Promise<AdminDiscountRow> {
  await requireAdmin();
  const data = toData(input);
  const dup = await prisma.discountCode.findUnique({ where: { storeId_code: { storeId: ORIGINAL_STORE_ID, code: data.code } } });
  if (dup) throw new ApiError(409, "Ya existe un descuento con ese código");
  return toRow(await prisma.discountCode.create({ data }));
}

export async function updateDiscount(
  id: string,
  input: DiscountInput,
): Promise<AdminDiscountRow> {
  await requireAdmin();
  const data = toData(input);
  const dup = await prisma.discountCode.findFirst({
    where: { code: data.code, id: { not: id } },
  });
  if (dup) throw new ApiError(409, "Ya existe otro descuento con ese código");
  const updated = await prisma.discountCode
    .update({ where: { id }, data })
    .catch(() => null);
  if (!updated) throw new ApiError(404, "Descuento no encontrado");
  return toRow(updated);
}

export async function deleteDiscount(id: string): Promise<void> {
  await requireAdmin();
  await prisma.discountCode.delete({ where: { id } }).catch(() => {
    throw new ApiError(404, "Descuento no encontrado");
  });
}
