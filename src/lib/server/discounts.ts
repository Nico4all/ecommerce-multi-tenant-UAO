import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { ApiError } from "./api-helpers";
import type { LegacyTransaction } from "./store-client";

export interface AppliedDiscount {
  codeId: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING" | "GIFT_CARD";
  /** Monto que descuenta del subtotal (0 para FREE_SHIPPING). */
  amount: number;
  freeShipping: boolean;
}

/**
 * Valida un código contra el subtotal actual. Lanza ApiError con mensaje
 * claro si no aplica (la API lo devuelve como 400).
 */
export async function validateDiscount(
  rawCode: string,
  subtotal: number,
): Promise<AppliedDiscount> {
  const code = rawCode.trim().toUpperCase();
  const { id: storeId } = await getStoreContext();
  const d = await prisma.discountCode.findUnique({ where: { storeId_code: { storeId, code } } });
  if (!d) throw new ApiError(400, "El código no existe");

  const now = new Date();
  if (d.status === "DISABLED") throw new ApiError(400, "Este código está desactivado");
  if (d.status === "EXPIRED" || (d.expiresAt && d.expiresAt < now))
    throw new ApiError(400, "Este código ya expiró");
  if (d.status === "SCHEDULED" && d.startsAt && d.startsAt > now)
    throw new ApiError(400, "Este código aún no está vigente");
  if (d.usageLimit !== null && d.usedCount >= d.usageLimit)
    throw new ApiError(400, "Este código alcanzó su límite de usos");

  const min = d.minPurchase === null ? 0 : Number(d.minPurchase);
  if (subtotal < min)
    throw new ApiError(
      400,
      `Este código requiere una compra mínima de $${min.toFixed(2)}`,
    );

  const value = Number(d.value);
  let amount = 0;
  let freeShipping = false;

  switch (d.type) {
    case "PERCENT":
      amount = Math.round(subtotal * (value / 100) * 100) / 100;
      break;
    case "FIXED":
      amount = Math.min(value, subtotal);
      break;
    case "GIFT_CARD": {
      const balance = d.balance === null ? value : Number(d.balance);
      if (balance <= 0) throw new ApiError(400, "La tarjeta ya no tiene saldo");
      amount = Math.min(balance, subtotal);
      break;
    }
    case "FREE_SHIPPING":
      freeShipping = true;
      break;
  }

  return {
    codeId: d.id,
    code: d.code,
    type: d.type,
    amount,
    freeShipping,
  };
}

/** Registrar el canje dentro de la misma transacción del pedido. */
export async function redeemDiscount(
  tx: LegacyTransaction,
  discount: AppliedDiscount,
  input: { orderId: string; userId: string; amount: number },
) {
  const { id: storeId } = await getStoreContext();
  const code = await tx.discountCode.findUnique({ where: { id: discount.codeId, storeId } });
  if (!code) throw new ApiError(400, "El código no existe");
  await tx.discountRedemption.create({
    data: { storeId, codeId: code.id, orderId: input.orderId, userId: input.userId, amount: input.amount },
  });
  await tx.discountCode.update({
    where: { id: code.id, storeId },
    data: {
      usedCount: { increment: 1 },
      ...(code.type === "GIFT_CARD" ? { balance: { decrement: input.amount } } : {}),
    },
  });
}
