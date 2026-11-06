import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { ORIGINAL_STORE_ID } from "../../../prisma/stores";

const commercialModels = new Set([
  "Category", "Product", "ProductImage", "ProductSpec", "ProductVariant",
  "Review", "Cart", "CartItem", "WishlistItem", "Order", "OrderItem",
  "OrderStatusEvent", "Payment", "DiscountCode", "DiscountRedemption",
  "Banner", "HomeSection", "EmailLog", "Notification", "SupportMessage",
]);

const userCommerce = ["orders", "reviews", "wishlist", "carts", "redemptions", "emails", "support", "memberships"];

function scopeUserReads(args: Record<string, unknown>) {
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
        fields[relation] = { ...options, where: { ...(options.where as object), storeId: ORIGINAL_STORE_ID } };
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

function assertStoreIds(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(assertStoreIds);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === "store" || (key === "storeId" && item !== ORIGINAL_STORE_ID)) {
      throw new Error("El contexto de tienda no puede ser sustituido por el cliente");
    }
    assertStoreIds(item);
  }
}

/** Adaptador temporal del storefront original; no resuelve tiendas por headers. */
export function legacyStoreClient(client: PrismaClient) {
  return client.$extends({
    name: "original-store",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!commercialModels.has(model) && model !== "User") return query(args);
          // E02 no habilita otras tiendas: una activación anticipada falla cerrada.
          const active = await client.store.findMany({
            where: { active: true },
            select: { id: true, legacyKey: true },
            take: 2,
          });
          if (active.length !== 1 || active[0].id !== ORIGINAL_STORE_ID ||
              active[0].legacyKey !== "original") {
            throw new Error("El storefront original requiere una única tienda activa validada");
          }
          assertStoreIds(args);
          if (model === "User") {
            scopeUserReads(args as unknown as Record<string, unknown>);
            return query(args);
          }
          const scoped = args as unknown as {
            where?: Record<string, unknown>;
            data?: Record<string, unknown> | Record<string, unknown>[];
            create?: Record<string, unknown>;
            update?: Record<string, unknown>;
          };
          if (operation !== "create" && operation !== "createMany") {
            scoped.where = { ...scoped.where, storeId: ORIGINAL_STORE_ID };
          }
          if (scoped.data) {
            scoped.data = Array.isArray(scoped.data)
              ? scoped.data.map((row) => ({ ...row, storeId: ORIGINAL_STORE_ID }))
              : { ...scoped.data, storeId: ORIGINAL_STORE_ID };
          }
          if (scoped.create) scoped.create = { ...scoped.create, storeId: ORIGINAL_STORE_ID };
          if (scoped.update) scoped.update = { ...scoped.update, storeId: ORIGINAL_STORE_ID };
          return query(args);
        },
      },
    },
  });
}

export type LegacyTransaction = Omit<ReturnType<typeof legacyStoreClient>,
  "$connect" | "$disconnect" | "$transaction" | "$extends">;
