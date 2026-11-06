import "server-only";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "./auth";
import { ApiError } from "./api-helpers";

/**
 * Cuenta del propio usuario (cliente o admin) sobre su sesión activa.
 *
 * Todo opera sobre el `userId` de la sesión —nunca sobre un id que mande el
 * cliente—, así un usuario solo puede tocar su propia cuenta.
 */

export interface ProfileInput {
  name: string;
  phone?: string | null;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  } | null;
}

export interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "CUSTOMER";
  /** `true` si la cuenta ya tiene contraseña (las de solo-Google no). */
  hasPassword: boolean;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  } | null;
}

export async function getProfile(userId: string): Promise<ProfileData | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: { where: { isDefault: true }, take: 1 } },
  });
  if (!u) return null;
  const a = u.addresses[0] ?? null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role as "ADMIN" | "CUSTOMER",
    hasPassword: !!u.passwordHash,
    address: a
      ? {
          street: a.street,
          city: a.city,
          state: a.state,
          zip: a.zip,
          country: a.country,
        }
      : null,
  };
}

/** Actualiza nombre, teléfono y dirección por defecto. Devuelve el perfil nuevo. */
export async function updateProfile(
  userId: string,
  input: ProfileInput,
): Promise<ProfileData> {
  await prisma.user.update({
    where: { id: userId },
    data: { name: input.name.trim(), phone: input.phone?.trim() || null },
  });

  if (input.address !== undefined) {
    await prisma.address.deleteMany({ where: { userId, isDefault: true } });
    if (input.address) {
      await prisma.address.create({
        data: { userId, ...input.address, isDefault: true },
      });
    }
  }

  const profile = await getProfile(userId);
  if (!profile) throw new ApiError(404, "Usuario no encontrado");
  return profile;
}

/**
 * Cambia la contraseña del usuario logueado.
 *
 * Si la cuenta ya tiene contraseña, exige la actual (evita que quien encuentre
 * una sesión abierta la cambie sin más). Las cuentas de solo-Google no tienen
 * contraseña: en ese caso se permite fijar una sin pedir la actual.
 */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string | undefined,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "Usuario no encontrado");

  if (user.passwordHash) {
    const ok =
      !!currentPassword &&
      (await verifyPassword(currentPassword, user.passwordHash));
    if (!ok) throw new ApiError(400, "La contraseña actual no es correcta");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}
