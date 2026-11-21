import "server-only";
import { isIP } from "node:net";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getStoreContext, runPlatformOperation } from "@/lib/prisma";
import { ApiError } from "./api-helpers";
import { hashPassword, requirePlatformAdmin } from "./auth";
import { normalizeAuthority } from "./store-context";

export const platformStoreSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  origin: z.url().max(2048),
  tagline: z.string().trim().max(160).default(""),
  city: z.string().trim().max(120).default(""),
  contactEmail: z.union([z.email(), z.literal("")]).default(""),
  ownerMode: z.enum(["new", "existing"]),
  ownerName: z.string().trim().max(160).optional(),
  ownerEmail: z.email().trim().toLowerCase(),
  ownerPassword: z.string().min(8).max(128).optional(),
  domainVerified: z.boolean().default(false),
  active: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if (value.ownerMode === "new" && (!value.ownerName || value.ownerName.length < 2)) context.addIssue({ code: "custom", path: ["ownerName"], message: "Escribe el nombre del propietario" });
  if (value.ownerMode === "new" && !value.ownerPassword) context.addIssue({ code: "custom", path: ["ownerPassword"], message: "Define la contraseña inicial del propietario" });
  if (value.ownerMode === "existing" && value.ownerPassword !== undefined) context.addIssue({ code: "custom", path: ["ownerPassword"], message: "Vincular una cuenta no cambia su contraseña" });
  if (value.active && !value.domainVerified) context.addIssue({ code: "custom", path: ["domainVerified"], message: "Verifica el dominio antes de activar el comercio" });
});

const selection = {
  id: true, name: true, slug: true, active: true, createdAt: true,
  domains: { select: { id: true, hostname: true, verifiedAt: true }, orderBy: { createdAt: "asc" as const } },
  settings: { select: { canonicalOrigin: true } },
  memberships: { where: { active: true, role: { in: ["OWNER", "ADMIN"] as ("OWNER" | "ADMIN")[] }, user: { status: "ACTIVE" as const } }, select: { role: true, user: { select: { name: true, email: true } } }, orderBy: { role: "asc" as const }, take: 1 },
  _count: { select: { productRecords: true, orderRecords: true } },
} satisfies Prisma.StoreSelect;
type Record = Prisma.StoreGetPayload<{ select: typeof selection }>;

function row(store: Record) {
  let origin: string | null = null;
  try {
    const address = storeOrigin(store.settings?.canonicalOrigin ?? "");
    if (store.domains.some(domain => domain.verifiedAt && domain.hostname === address.hostname)) origin = address.origin;
  } catch { /* Una URL incompleta nunca se convierte en enlace del panel. */ }
  return {
    id: store.id, name: store.name, slug: store.slug, active: store.active,
    createdAt: store.createdAt.toISOString(), origin: store.active ? origin : null,
    domains: store.domains.map(domain => ({ id: domain.id, hostname: domain.hostname, verified: !!domain.verifiedAt })),
    owner: store.memberships[0]?.user ?? null,
    products: store._count.productRecords, orders: store._count.orderRecords,
  };
}
export type PlatformStore = ReturnType<typeof row>;

export async function assertPlatformMutation(request: Request) {
  await requirePlatformAdmin();
  if (request.headers.get("origin") !== (await getStoreContext()).origin) throw new ApiError(403, "Origen de solicitud no autorizado");
}

export async function listPlatformStores() {
  return runPlatformOperation(async database => ({
    stores: (await database.store.findMany({ select: selection, orderBy: { createdAt: "desc" }, take: 100 })).map(row),
    total: await database.store.count(),
  }));
}

function storeOrigin(value: string) {
  const url = new URL(value);
  const authority = normalizeAuthority(url.host);
  const local = authority.hostname.endsWith(".localhost");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || isIP(authority.hostname) || authority.hostname === "localhost" ||
    (local && process.env.NODE_ENV !== "development") ||
    (url.protocol !== "https:" && !(local && process.env.NODE_ENV === "development" && url.protocol === "http:"))) {
    throw new ApiError(400, "Usa una URL HTTPS de tienda; los alias .localhost solo funcionan en desarrollo");
  }
  return { hostname: authority.hostname, origin: new URL(`${url.protocol}//${authority.authority}`).origin };
}

export async function createPlatformStore(input: z.infer<typeof platformStoreSchema>) {
  return runPlatformOperation(async database => {
    const address = storeOrigin(input.origin);
    const passwordHash = input.ownerMode === "new" ? await hashPassword(input.ownerPassword!) : null;
    try {
      return await database.$transaction(async tx => {
        let owner = await tx.user.findUnique({ where: { email: input.ownerEmail }, select: { id: true, status: true } });
        if (input.ownerMode === "new" && owner) throw new ApiError(409, "La cuenta ya existe; selecciona vincular una cuenta existente");
        if (input.ownerMode === "existing" && !owner) throw new ApiError(404, "No existe la cuenta que quieres vincular");
        if (owner?.status === "INACTIVE") throw new ApiError(409, "La cuenta del propietario está desactivada");
        if (!owner) owner = await tx.user.create({ data: { name: input.ownerName!, email: input.ownerEmail, passwordHash, role: "CUSTOMER" }, select: { id: true, status: true } });
        const store = await tx.store.create({ data: { name: input.name, slug: input.slug, active: input.active } });
        await tx.storeSettings.create({ data: { storeId: store.id, canonicalOrigin: address.origin, tagline: input.tagline || null, city: input.city || null, contactEmail: input.contactEmail || input.ownerEmail, notificationEmail: input.ownerEmail } });
        await tx.storeDomain.create({ data: { storeId: store.id, hostname: address.hostname, verifiedAt: input.domainVerified ? new Date() : null } });
        await tx.storeMembership.create({ data: { storeId: store.id, userId: owner.id, role: "OWNER" } });
        return row(await tx.store.findUniqueOrThrow({ where: { id: store.id }, select: selection }));
      }, { isolationLevel: "ReadCommitted", timeout: 15000 });
    } catch (error) {
      if (error instanceof Error && "code" in error && ["P2002", "P2034"].includes(String(error.code))) throw new ApiError(409, "El identificador, dominio o correo ya está en uso; actualiza e intenta de nuevo");
      throw error;
    }
  });
}

export async function activatePlatformStore(id: string, domainId: string) {
  return runPlatformOperation(database => database.$transaction(async tx => {
    const store = await tx.store.findUnique({ where: { id }, select: { id: true, domains: { where: { id: domainId }, select: { id: true } }, memberships: { where: { role: "OWNER", active: true, user: { status: "ACTIVE" } }, select: { userId: true }, take: 1 } } });
    if (!store || !store.domains.length) throw new ApiError(404, "Comercio o dominio no encontrado");
    if (!store.memberships.length) throw new ApiError(409, "El comercio necesita un propietario activo");
    await tx.storeDomain.update({ where: { id: domainId, storeId: id }, data: { verifiedAt: new Date() } });
    await tx.store.update({ where: { id }, data: { active: true } });
    return row(await tx.store.findUniqueOrThrow({ where: { id }, select: selection }));
  }, { isolationLevel: "ReadCommitted" }));
}
