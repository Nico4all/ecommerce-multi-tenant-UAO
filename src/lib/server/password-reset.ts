import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "./auth";
import { sendEmail } from "./email";
import { buildPasswordResetEmail } from "./auth-email";
import { ApiError } from "./api-helpers";

/**
 * Recuperación de contraseña por enlace (self-service).
 *
 * Flujo: el usuario pide un enlace con su correo -> se le envía uno con un token
 * de un solo uso que caduca en 1 hora -> abre el enlace y fija una contraseña
 * nueva. El token viaja en la URL en claro, pero en la BD solo guardamos su
 * hash: filtrar la tabla no basta para secuestrar una cuenta.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

/** sha-256 en hex del token. Determinista: permite buscar por hash. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Crea un token de recuperación para `email` y envía el correo.
 *
 * No revela si el correo existe: responde igual haya o no cuenta (evita que
 * alguien sondee qué correos están registrados). Por eso no lanza ApiError.
 */
export async function requestPasswordReset(
  email: string,
  origin: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user) return; // silencio deliberado

  // Un token vigente por usuario: se invalidan los anteriores al pedir uno nuevo.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const raw = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const link = `${origin}/restablecer?token=${raw}`;
  const mail = buildPasswordResetEmail({
    nombre: user.name.split(" ")[0],
    link,
    appUrl: origin,
  });
  await sendEmail({ ...mail, to: user.email });
}

/**
 * Consume un token y fija la nueva contraseña. Lanza 400 si el enlace es
 * inválido, ya se usó o caducó.
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<void> {
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!token || token.usedAt || token.expiresAt < new Date()) {
    throw new ApiError(
      400,
      "El enlace no es válido o ya venció. Solicita uno nuevo.",
    );
  }

  // Marca el token usado y cambia la contraseña en una sola transacción.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
