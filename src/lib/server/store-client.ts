import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { ORIGINAL_STORE_ID } from "../../../prisma/stores";
import { resolveStoreContext, StoreContextError, type StoreContext } from "./store-context";

const commercialModels = new Set([
  "Category", "Product", "ProductImage", "ProductSpec", "ProductVariant",
  "Review", "Cart", "CartItem", "WishlistItem", "Order", "OrderItem",
  "OrderStatusEvent", "Payment", "DiscountCode", "DiscountRedemption",
  "Banner", "HomeSection", "EmailLog", "Notification", "SupportMessage",
]);

const userCommerce = ["orders", "reviews", "wishlist", "carts", "redemptions", "emails", "support", "memberships"];

function scopeUserReads(args: Record<string, unknown>, storeId: string) {
  for (const key of ["data", "create", "update"]) {
    const data = args[key] as Record<string, unknown> | undefined;
    if (data && userCommerce.some((relation) => relation in data)) {
      throw new Error("Las escrituras comerciales deben pasar por su modelo con contexto de tienda");
    }
  }
  for (const key of ["include", "select"]) {
    const selection = args[key] as Record<string, unknown> | undefined;
    if (!selection) continue;
    const restrict = (fields: Record<string, unknown>) => {
      for (const relation of userCommerce) {
        const value = fields[relation];
        if (!value) continue;
        const options = value === true ? {} : value as Record<string, unknown>;
        fields[relation] = { ...options, where: { ...(options.where as object), storeId } };
      }
    };
    restrict(selection);
    if (selection._count) {
      if (selection._count === true) {
        selection._count = { select: Object.fromEntries(["addresses", "resetTokens", ...userCommerce].map((name) => [name, true])) };
      }
      const count = selection._count as { select?: Record<string, unknown> };
      if (count.select) restrict(count.select);
    }
  }
}

function assertStoreIds(value: unknown, storeId: string): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => assertStoreIds(item, storeId));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === "store" || (key === "storeId" && item !== storeId)) {
      throw new Error("El contexto de tienda no puede ser sustituido por el cliente");
    }
    assertStoreIds(item, storeId);
  }
}

// Solo clonar objetos de argumentos: conservar Date, Decimal y binarios.
function cloneArgs<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneArgs) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneArgs(item)])) as T;
  }
  return value;
}

function scopeNestedUsers(value: unknown, storeId: string): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach((item) => scopeNestedUsers(item, storeId)); return; }
  if (Object.getPrototypeOf(value) !== Object.prototype) return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "user" && item && typeof item === "object") scopeUserReads(item as Record<string, unknown>, storeId);
    scopeNestedUsers(item, storeId);
  }
}

export function storeScopedClient(client: PrismaClient, getContext: () => Promise<StoreContext>) {
  const denyRaw = () => { throw new StoreContextError(403, "SQL directo no disponible en el cliente de tienda"); };
  return client.$extends({
    name: "request-store",
    query: {
      $queryRaw: denyRaw, $queryRawUnsafe: denyRaw,
      $executeRaw: denyRaw, $executeRawUnsafe: denyRaw,
      $allModels: {
        async $allOperations({ model, operation, args: originalArgs, query }) {
          const { id: storeId } = await getContext();
          const args = cloneArgs(originalArgs);
          if (model === "Store") throw new StoreContextError(403, "La plataforma no se consulta desde el cliente de tienda");
          assertStoreIds(args, storeId);
          scopeNestedUsers(args, storeId);
          if (model === "User") {
            scopeUserReads(args as unknown as Record<string, unknown>, storeId);
            return query(args);
          }
          if (!commercialModels.has(model) && !["StoreDomain", "StoreMembership", "StoreSettings"].includes(model)) return query(args);
          const scoped = args as unknown as {
            where?: Record<string, unknown>;
            data?: Record<string, unknown> | Record<string, unknown>[];
            create?: Record<string, unknown>;
            update?: Record<string, unknown>;
          };
          if (operation !== "create" && operation !== "createMany") {
            scoped.where = { ...scoped.where, storeId };
          }
          if (scoped.data) {
            scoped.data = Array.isArray(scoped.data)
              ? scoped.data.map((row) => ({ ...row, storeId }))
              : { ...scoped.data, storeId };
          }
          if (scoped.create) scoped.create = { ...scoped.create, storeId };
          if (scoped.update) scoped.update = { ...scoped.update, storeId };
          return query(args);
        },
      },
    },
  });
}

/** Compatibilidad del ensayo histórico E02; la aplicación usa storeScopedClient. */
export function legacyStoreClient(client: PrismaClient) {
  return storeScopedClient(client, async () => {
    const active = await client.store.findMany({ where: { active: true }, select: { id: true, legacyKey: true }, take: 2 });
    if (active.length !== 1 || active[0].id !== ORIGINAL_STORE_ID || active[0].legacyKey !== "original") {
      throw new Error("El storefront original requiere una única tienda activa validada");
    }
    return resolveStoreContext(client, new Headers({ host: "localhost" }), { environment: "development" });
  });
}

export type LegacyTransaction = Omit<ReturnType<typeof storeScopedClient>,
  "$connect" | "$disconnect" | "$transaction" | "$extends">;
