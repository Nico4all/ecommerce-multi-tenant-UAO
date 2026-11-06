import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAdmin, hashPassword } from "../auth";
import { ApiError } from "../api-helpers";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  orders: number;
  totalSpent: number;
  status: "ACTIVE" | "INACTIVE";
  joinedAt: string;
  role: "ADMIN" | "CUSTOMER";
}

export interface AdminUserDetail extends AdminUserRow {
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  } | null;
  recentOrders: {
    id: string;
    code: string;
    date: string;
    items: number;
    status: string;
    total: number;
  }[];
}

export interface UserInput {
  name: string;
  email: string;
  phone?: string;
  status?: "ACTIVE" | "INACTIVE";
  /** Rol al crear (por defecto CUSTOMER). */
  role?: "ADMIN" | "CUSTOMER";
  /** Contraseña inicial (obligatoria si el rol es ADMIN). */
  password?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

const userInclude = {
  addresses: { where: { isDefault: true }, take: 1 },
  orders: { select: { total: true, status: true } },
};

type UserWithExtras = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: Date;
  addresses: { street: string; city: string; state: string; zip: string; country: string }[];
  orders: { total: unknown; status: string }[];
};

function toRow(u: UserWithExtras): AdminUserRow {
  const addr = u.addresses[0];
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? "—",
    city: addr?.city ?? "—",
    state: addr?.state ?? "—",
    orders: u.orders.length,
    totalSpent: u.orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((s, o) => s + Number(o.total), 0),
    status: u.status as "ACTIVE" | "INACTIVE",
    joinedAt: u.createdAt.toISOString().slice(0, 10),
    role: u.role as "ADMIN" | "CUSTOMER",
  };
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  await requireAdmin();
  // Incluye admins y clientes: el panel gestiona ambos (crear admins, resetear
  // contraseñas). El rol viaja en cada fila para distinguirlos en la tabla.
  const rows = await prisma.user.findMany({
    include: userInclude,
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toRow);
}

export async function getAdminUser(id: string): Promise<AdminUserDetail | null> {
  await requireAdmin();
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      ...userInclude,
      orders: undefined,
    },
  });
  if (!u) return null;

  const orders = await prisma.order.findMany({
    where: { userId: id },
    include: { items: { select: { qty: true } } },
    orderBy: { createdAt: "desc" },
  });

  const addr = u.addresses[0] ?? null;
  return {
    ...toRow({
      ...u,
      orders: orders.map((o) => ({ total: o.total, status: o.status })),
    }),
    address: addr
      ? {
          street: addr.street,
          city: addr.city,
          state: addr.state,
          zip: addr.zip,
          country: addr.country,
        }
      : null,
    recentOrders: orders.map((o) => ({
      id: o.id,
      code: o.code,
      date: o.createdAt.toISOString().slice(0, 10),
      items: o.items.reduce((s, i) => s + i.qty, 0),
      status: o.status,
      total: Number(o.total),
    })),
  };
}

export async function createAdminUser(input: UserInput): Promise<AdminUserRow> {
  await requireAdmin();
  const dup = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (dup) throw new ApiError(409, "Ya existe un usuario con ese correo");

  const created = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      role: input.role ?? "CUSTOMER",
      status: input.status ?? "ACTIVE",
      // Con contraseña => la cuenta ya puede entrar (así se crea un admin y se le
      // pasan las credenciales). Sin ella => invitación: la fija al registrarse.
      passwordHash: input.password ? await hashPassword(input.password) : null,
      ...(input.address
        ? { addresses: { create: { ...input.address, isDefault: true } } }
        : {}),
    },
    include: userInclude,
  });
  return toRow(created);
}

/** Fija (resetea) la contraseña de un usuario desde el panel. */
export async function setUserPassword(id: string, password: string): Promise<void> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ApiError(404, "Usuario no encontrado");
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  });
}

export async function updateAdminUser(
  id: string,
  input: UserInput,
): Promise<AdminUserRow> {
  await requireAdmin();
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Usuario no encontrado");

  const dup = await prisma.user.findFirst({
    where: { email: input.email.toLowerCase(), id: { not: id } },
  });
  if (dup) throw new ApiError(409, "Ya existe otro usuario con ese correo");

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      status: input.status ?? "ACTIVE",
    },
    include: userInclude,
  });

  if (input.address) {
    await prisma.address.deleteMany({ where: { userId: id, isDefault: true } });
    await prisma.address.create({
      data: { userId: id, ...input.address, isDefault: true },
    });
  }

  return toRow(updated);
}

export async function deleteAdminUser(id: string): Promise<void> {
  await requireAdmin();
  await prisma.user.delete({ where: { id } }).catch(() => {
    throw new ApiError(404, "Usuario no encontrado");
  });
}
