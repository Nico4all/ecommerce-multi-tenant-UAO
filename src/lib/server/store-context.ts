import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import type { PrismaClient } from "../../generated/prisma/client";
import { ORIGINAL_STORE_ID } from "../../../prisma/stores";

export class StoreContextError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "StoreContextError";
  }
}

const validated = Symbol("validated-store-context");
export interface StoreContext {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly hostname: string;
  readonly authority: string;
  readonly origin: string;
  readonly [validated]: true;
}

// El contenedor guarda un valor por cadena asíncrona, nunca una tienda global.
const requests = new AsyncLocalStorage<StoreContext>();
export const currentStoreContext = () => requests.getStore();

export function requireStoreContext(): StoreContext {
  const context = currentStoreContext();
  if (!context) throw new StoreContextError(503, "Falta un contexto de tienda validado");
  return context;
}

export function runWithStoreContext<T>(context: StoreContext, callback: () => T): T {
  if (context[validated] !== true) throw new StoreContextError(400, "Contexto de tienda inválido");
  const current = currentStoreContext();
  if (current && current.id !== context.id) {
    throw new StoreContextError(400, "No se puede cambiar de tienda dentro del request");
  }
  return requests.run(context, callback);
}

export function normalizeAuthority(value: string): { hostname: string; authority: string } {
  if (!value || value !== value.trim() || /[\s,@/\\?#%]/u.test(value)) {
    throw new StoreContextError(400, "Host inválido");
  }
  let hostname: string;
  let port: string | undefined;
  if (value.startsWith("[")) {
    const ipv6 = /^(\[[\da-f:.]+\])(?::(\d+))?$/i.exec(value);
    if (!ipv6 || isIP(ipv6[1].slice(1, -1)) !== 6) throw new StoreContextError(400, "Host inválido");
    hostname = new URL(`http://${ipv6[1]}`).hostname.slice(1, -1);
    port = ipv6[2];
  } else {
    const parts = value.split(":");
    if (parts.length > 2) throw new StoreContextError(400, "Host inválido");
    const name = parts[0].replace(/\.$/, "");
    hostname = domainToASCII(name).toLowerCase();
    if (!hostname || hostname.length > 253 || hostname.split(".").some((label) =>
      label.length > 63 || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)) ||
      (/^[\d.]+$/.test(hostname) && isIP(hostname) !== 4)) {
      throw new StoreContextError(400, "Host inválido");
    }
    // No aceptar formatos numéricos abreviados que URL convertiría a loopback.
    if (isIP(hostname) === 4 && name !== hostname) throw new StoreContextError(400, "Host inválido");
    port = parts[1];
    if (parts.length === 2 && !port) throw new StoreContextError(400, "Puerto inválido");
  }
  if (port !== undefined && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    throw new StoreContextError(400, "Puerto inválido");
  }
  const host = isIP(hostname) === 6 ? `[${hostname}]` : hostname;
  return { hostname, authority: port ? `${host}:${Number(port)}` : host };
}

export interface ProxyConnection {
  // Debe venir del socket/ingress, jamás de X-Forwarded-For u otra cabecera.
  readonly peerAddress: string;
  readonly allowedPeers: readonly string[];
}
type HeaderSource = Pick<Headers, "get">;

function forwardedHost(value: string): string | undefined {
  if (value.includes(",")) throw new StoreContextError(400, "Proxy con múltiples saltos ambiguos");
  const fields = new Map<string, string>();
  for (const part of value.split(";")) {
    const match = /^\s*([a-z][a-z\d_-]*)=(?:"([^"\\]*)"|([^"\s;]+))\s*$/i.exec(part);
    if (!match || fields.has(match[1].toLowerCase())) throw new StoreContextError(400, "Forwarded inválido");
    fields.set(match[1].toLowerCase(), match[2] ?? match[3]);
  }
  return fields.get("host");
}

export function requestAuthority(headers: HeaderSource, connection?: ProxyConnection) {
  const host = headers.get("host");
  if (!host) throw new StoreContextError(400, "Falta Host");
  const direct = normalizeAuthority(host);
  const trusted = connection && isIP(connection.peerAddress) !== 0 &&
    connection.allowedPeers.includes(connection.peerAddress);
  if (!trusted) return direct;
  const forwarded = headers.get("forwarded");
  const hostFromForwarded = forwarded ? forwardedHost(forwarded) : undefined;
  const xHost = headers.get("x-forwarded-host");
  const first = hostFromForwarded ? normalizeAuthority(hostFromForwarded) : undefined;
  const second = xHost ? normalizeAuthority(xHost) : undefined;
  if (first && second && first.authority !== second.authority) {
    throw new StoreContextError(400, "Cabeceras de proxy contradictorias");
  }
  return first ?? second ?? direct;
}

export async function resolveStoreContext(
  client: Pick<PrismaClient, "store" | "storeDomain">,
  headers: HeaderSource,
  options: { environment: string; connection?: ProxyConnection },
): Promise<StoreContext> {
  const authority = requestAuthority(headers, options.connection);
  const local = authority.hostname === "localhost" || authority.hostname === "::1" ||
    (isIP(authority.hostname) === 4 && authority.hostname.startsWith("127.")) ||
    /^::ffff:7f[\da-f]{2}:/i.test(authority.hostname) || authority.hostname.endsWith(".localhost");
  if (local && options.environment !== "development") throw new StoreContextError(404, "Tienda no encontrada");
  const store = local && !authority.hostname.endsWith(".localhost")
    ? await client.store.findFirst({ where: { id: ORIGINAL_STORE_ID, legacyKey: "original", active: true } })
    : (await client.storeDomain.findFirst({
      where: { hostname: authority.hostname, verifiedAt: { not: null }, store: { active: true } },
      include: { store: true },
    }))?.store;
  if (!store) throw new StoreContextError(404, "Tienda no encontrada");
  return Object.freeze({
    id: store.id, name: store.name, slug: store.slug, ...authority,
    origin: new URL(`${options.environment === "development" ? "http" : "https"}://${authority.authority}`).origin,
    [validated]: true as const,
  });
}

/** Contexto de conciliación: ID obtenido de un pago persistido, nunca del Host. */
export async function resolvePersistedStoreContext(
  client: Pick<PrismaClient, "store">,
  storeId: string,
): Promise<StoreContext> {
  const store = await client.store.findUnique({
    where: { id: storeId },
    include: { domains: { where: { verifiedAt: { not: null } }, orderBy: [{ createdAt: "asc" }, { hostname: "asc" }], take: 1 } },
  });
  // Se concilian cobros incluso si se desactivó el storefront después de comprar.
  const hostname = store?.domains[0]?.hostname;
  if (!store || !hostname) throw new StoreContextError(503, "Falta un dominio verificado para conciliar el pago");
  const authority = normalizeAuthority(hostname);
  return Object.freeze({
    id: store.id, name: store.name, slug: store.slug, ...authority,
    origin: new URL(`https://${authority.authority}`).origin, [validated]: true as const,
  });
}
