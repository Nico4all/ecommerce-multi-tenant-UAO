import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { storeScopedClient } from "./server/store-client";
import { requestStoreResolvers } from "./server/request-store";
import { resolvePersistedStoreContext } from "./server/store-context";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está configurada");

  const adapter = new PrismaMariaDb(url);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const client = globalForPrisma.prisma ?? createClient();
const requests = requestStoreResolvers(client);
export const getStoreContext = requests.getContext;
export const resolveStoreRequest = requests.resolveRequest;
export const prisma = storeScopedClient(client, getStoreContext);

/** Lookup de plataforma acotado; el webhook lo usa después de autenticar al proveedor. */
export async function resolveWompiPaymentStore(gatewayReference: string) {
  const payment = await client.payment.findUnique({
    where: { gatewayReference, method: "WOMPI" }, select: { storeId: true },
  });
  return payment ? resolvePersistedStoreContext(client, payment.storeId) : null;
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
