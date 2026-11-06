import { ORIGINAL_STORE_ID } from "../../../prisma/stores";
import "server-only";
import { prisma } from "@/lib/prisma";
import { ApiError } from "./api-helpers";

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
  const d = await prisma.discountCode.findUnique({ where: { storeId_code: { storeId: ORIGINAL_STORE_ID, code } } });
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
