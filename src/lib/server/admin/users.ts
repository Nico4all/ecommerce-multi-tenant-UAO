import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { requireAdmin, hashPassword } from "../auth";
import { ApiError } from "../api-helpers";
import { publicStoreRole } from "../memberships";

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
  memberships: { select: { role: true, active: true } },
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
  memberships: { role: string; active: boolean }[];
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
    status: u.status === "ACTIVE" && u.memberships[0]?.active ? "ACTIVE" : "INACTIVE",
    joinedAt: u.createdAt.toISOString().slice(0, 10),
    role: publicStoreRole(u.memberships[0]?.role ?? "CUSTOMER"),
  };
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  // Incluye admins y clientes: el panel gestiona ambos (crear admins, resetear
  // contraseñas). El rol viaja en cada fila para distinguirlos en la tabla.
  const rows = await prisma.user.findMany({
    where: { memberships: { some: { storeId } } },
    include: userInclude,
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toRow);
}

export async function getAdminUser(id: string): Promise<AdminUserDetail | null> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  const u = await prisma.user.findUnique({
    where: { id, memberships: { some: { storeId } } },
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
  const { id: storeId } = await getStoreContext();
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new ApiError(409, "Ya existe una identidad con ese correo");
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name, email, phone: input.phone ?? null, role: "CUSTOMER", passwordHash,
        ...(input.address ? { addresses: { create: { ...input.address, isDefault: true } } } : {}),
      },
    });
    await tx.storeMembership.create({
      data: { storeId, userId: user.id, role: input.role ?? "CUSTOMER", active: input.status !== "INACTIVE" },
    });
    return toRow(await tx.user.findUniqueOrThrow({ where: { id: user.id }, include: userInclude }));
  });
}

/** La contraseña global solo se cambia con reautenticación propia o recuperación. */
export async function setUserPassword(id: string, password: string): Promise<void> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  const member = await prisma.storeMembership.findUnique({ where: { storeId_userId: { storeId, userId: id } } });
  if (!member) throw new ApiError(404, "Usuario no encontrado");
  void password;
  throw new ApiError(403, "Usa el cambio propio o la recuperación de contraseña de la identidad global");
}

export async function updateAdminUser(id: string, input: UserInput): Promise<AdminUserRow> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  const user = await prisma.user.findUnique({
    where: { id, memberships: { some: { storeId } } }, include: userInclude,
  });
  if (!user) throw new ApiError(404, "Usuario no encontrado");
  const address = user.addresses[0];
  const changedAddress = input.address && Object.entries(input.address).some(([key, value]) => address?.[key as keyof typeof address] !== value);
  if (input.name !== user.name || input.email.trim().toLowerCase() !== user.email.toLowerCase() ||
    (input.phone ?? "") !== (user.phone ?? "") || changedAddress || input.password) {
    throw new ApiError(403, "El perfil y las credenciales globales solo los modifica su titular");
  }
  const member = user.memberships[0];
  if (member.role === "OWNER" && (input.status === "INACTIVE" || input.role === "CUSTOMER")) throw new ApiError(403, "No se puede retirar al propietario desde este formulario");
  await prisma.storeMembership.update({
    where: { storeId_userId: { storeId, userId: id } },
    data: { ...(input.status ? { active: input.status === "ACTIVE" } : {}), ...(input.role && member.role !== "OWNER" ? { role: input.role } : {}) },
  });
  return toRow(await prisma.user.findUniqueOrThrow({ where: { id }, include: userInclude }));
}

/** Retirar acceso a esta tienda conserva identidad, pedidos y membresías de las demás. */
export async function deleteAdminUser(id: string): Promise<void> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  const member = await prisma.storeMembership.findUnique({ where: { storeId_userId: { storeId, userId: id } } });
  if (!member) throw new ApiError(404, "Usuario no encontrado");
  if (member.role === "OWNER") throw new ApiError(403, "No se puede retirar al propietario desde este formulario");
  await prisma.storeMembership.delete({ where: { storeId_userId: { storeId, userId: id } } });
}
