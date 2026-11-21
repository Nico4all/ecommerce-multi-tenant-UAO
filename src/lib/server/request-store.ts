import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { PrismaClient } from "../../generated/prisma/client";
import { currentStoreContext, resolveStoreContext, StoreContextError } from "./store-context";

export function requestStoreResolvers(client: PrismaClient) {
  // No hay proxy configurado: no se autoriza Forwarded/X-Forwarded-Host.
  const resolveRequest = (request: Pick<Request, "headers">) => resolveStoreContext(client, request.headers, {
    environment: process.env.NODE_ENV ?? "production",
  });
  // React descarta esta memoización al terminar cada render/request de servidor.
  const renderContext = cache(async () => {
    try {
      return await resolveRequest({ headers: await headers() });
    } catch (error) {
      if (error instanceof StoreContextError && [400, 404].includes(error.status)) notFound();
      throw error;
    }
  });
  return {
    resolveRequest,
    getContext: () => {
      const current = currentStoreContext();
      return current ? Promise.resolve(current) : renderContext();
    },
  };
}
