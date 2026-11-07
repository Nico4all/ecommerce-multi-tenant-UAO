import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { storeScopedClient } from "./server/store-client";
import { requestStoreResolvers } from "./server/request-store";

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

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
