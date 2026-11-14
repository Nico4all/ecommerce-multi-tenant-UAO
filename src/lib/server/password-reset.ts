import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { prisma, getStoreContext } from "@/lib/prisma";
import { hashPassword } from "./auth";
import { sendEmail } from "./email";
import { buildPasswordResetEmail } from "./auth-email";
import { ApiError } from "./api-helpers";
import { getCommercialSettings } from "./commercial-settings";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Respuesta uniforme; el enlace solo procede del origen validado de esta tienda. */
export async function requestPasswordReset(email: string, origin: string): Promise<void> {
  const store = await getStoreContext();
  if (origin !== store.origin) throw new ApiError(400, "Origen de recuperación inválido");
  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase(), status: "ACTIVE", memberships: { some: { storeId: store.id, active: true } } },
  });
  if (!user) return;
  const raw = randomBytes(32).toString("hex");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id, status: "ACTIVE" }, data: { updatedAt: new Date() } });
    const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    await tx.passwordResetToken.deleteMany({ where: { storeId: store.id, userId: user.id } });
    await tx.passwordResetToken.create({
      data: { storeId: store.id, userId: user.id, sessionVersion: current.sessionVersion, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });
  }, { isolationLevel: "ReadCommitted" });
  try {
    const mail = buildPasswordResetEmail({
      nombre: user.name.split(" ")[0], link: `${store.origin}/restablecer?token=${raw}`, appUrl: store.origin,
      branding: (await getCommercialSettings()).branding,
    });
    await sendEmail({ ...mail, to: user.email });
  } catch { console.warn("[password-reset] correo de recuperación no disponible"); }
}

/** Reclamo condicional: un solo consumidor y revocación de todas las sesiones anteriores. */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const { id: storeId } = await getStoreContext();
  const invalid = () => new ApiError(400, "El enlace no es válido o ya venció. Solicita uno nuevo.");
  const tokenHash = hashToken(rawToken);
  const found = await prisma.passwordResetToken.findUnique({ where: { tokenHash, storeId } });
  if (!found) throw invalid();
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const locked = await tx.user.updateMany({
      where: { id: found.userId, status: "ACTIVE", sessionVersion: found.sessionVersion },
      data: { sessionVersion: { increment: 0 } },
    });
    if (!locked.count) throw invalid();
    const member = await tx.storeMembership.findUnique({ where: { storeId_userId: { storeId, userId: found.userId }, active: true } });
    if (!member) throw invalid();
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: found.id, storeId, userId: found.userId, usedAt: null, expiresAt: { gt: new Date() }, sessionVersion: found.sessionVersion },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw invalid();
    await tx.user.update({
      where: { id: found.userId }, data: { passwordHash, sessionVersion: { increment: 1 } },
    });
  }, { isolationLevel: "ReadCommitted" });
}
