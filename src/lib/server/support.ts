import "server-only";
import { randomInt } from "node:crypto";
import { prisma, getStoreContext } from "@/lib/prisma";
import { getSession, requireAdmin } from "./auth";
import { notifySupportMessage } from "./notifications";
import { alertStoreSupportMessage } from "./store-alerts";
import { sendEmail } from "./email";
import { buildSupportReplyEmail } from "./support-email";
import { ApiError } from "./api-helpers";
import { getCommercialSettings } from "./commercial-settings";

/**
 * PQR y mensajes de contacto.
 *
 * Se guardan en la BD y el equipo los lee en /admin/mensajes. Al responder desde
 * el panel, la respuesta también le llega por correo al cliente (ver
 * `updateSupportMessage` + `support-email.ts`).
 */

export type SupportKind =
  | "PETICION"
  | "QUEJA"
  | "RECLAMO"
  | "SUGERENCIA"
  | "CONTACTO";

export type SupportStatus = "NUEVO" | "EN_PROCESO" | "RESUELTO" | "CERRADO";

export interface SupportInput {
  kind: SupportKind;
  name: string;
  email: string;
  phone?: string | null;
  docId?: string | null;
  orderCode?: string | null;
  subject: string;
  message: string;
}

export interface SupportMessageDTO {
  id: string;
  radicado: string;
  kind: SupportKind;
  status: SupportStatus;
  name: string;
  email: string;
  phone: string | null;
  docId: string | null;
  orderCode: string | null;
  subject: string;
  message: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

/** Las PQR llevan radicado "PQR-"; los mensajes libres, "CON-". */
function prefixFor(kind: SupportKind): string {
  return kind === "CONTACTO" ? "CON" : "PQR";
}

/**
 * Conserva prefijo/año y evita colisiones del índice global sin consultar
 * contadores de otra tienda. Los radicados históricos siguen siendo válidos.
 */
function nextRadicado(kind: SupportKind): string {
  const prefix = prefixFor(kind);
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(randomInt(0, 1_000_000_000_000)).padStart(12, "0")}`;
}

export async function createSupportMessage(
  input: SupportInput,
): Promise<{ radicado: string }> {
  // Si hay sesión, el mensaje queda ligado a la cuenta; si no, es de invitado.
  const session = await getSession();
  const { id: storeId } = await getStoreContext();
  if (input.orderCode && !await prisma.order.findFirst({ where: { storeId, code: input.orderCode }, select: { id: true } })) throw new ApiError(404, "Pedido no encontrado");

  const data = {
    storeId,
    kind: input.kind,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    docId: input.docId || null,
    orderCode: input.orderCode || null,
    subject: input.subject,
    message: input.message,
    userId: session?.id ?? null,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.supportMessage.create({
        data: { ...data, radicado: nextRadicado(input.kind) },
      });
      await notifySupportMessage({
        id: created.id,
        radicado: created.radicado,
        kind: created.kind,
        name: created.name,
        subject: created.subject,
      });
      // Además de la campana del panel, el mensaje llega al correo del equipo.
      await alertStoreSupportMessage({
        id: created.id,
        radicado: created.radicado,
        kind: created.kind as SupportKind,
        name: created.name,
        email: created.email,
        phone: created.phone,
        docId: created.docId,
        orderCode: created.orderCode,
        subject: created.subject,
        message: created.message,
      });
      return { radicado: created.radicado };
    } catch (e) {
      // Una colisión del identificador se reintenta sin exponer otras tiendas.
      const code = (e as { code?: string }).code;
      if (code !== "P2002") throw e;
    }
  }
  throw new ApiError(503, "No pudimos radicar tu mensaje. Intenta de nuevo.");
}

type Row = {
  id: string;
  radicado: string;
  kind: string;
  status: string;
  name: string;
  email: string;
  phone: string | null;
  docId: string | null;
  orderCode: string | null;
  subject: string;
  message: string;
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
};

function toDTO(m: Row): SupportMessageDTO {
  return {
    id: m.id,
    radicado: m.radicado,
    kind: m.kind as SupportKind,
    status: m.status as SupportStatus,
    name: m.name,
    email: m.email,
    phone: m.phone,
    docId: m.docId,
    orderCode: m.orderCode,
    subject: m.subject,
    message: m.message,
    response: m.response,
    respondedAt: m.respondedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Bandeja del panel. `status`/`kind` opcionales para filtrar. */
export async function listSupportMessages(filter?: {
  status?: SupportStatus;
  kind?: SupportKind;
}): Promise<SupportMessageDTO[]> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  const rows = await prisma.supportMessage.findMany({
    where: {
      storeId,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.kind ? { kind: filter.kind } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function getSupportMessage(
  id: string,
): Promise<SupportMessageDTO | null> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  const row = await prisma.supportMessage.findUnique({ where: { id, storeId } });
  return row ? toDTO(row) : null;
}

/** Cuenta de mensajes sin abrir, para el badge del menú del panel. */
export async function countNewSupportMessages(): Promise<number> {
  await requireAdmin();
  const { id: storeId } = await getStoreContext();
  return prisma.supportMessage.count({ where: { storeId, status: "NUEVO" } });
}

export async function updateSupportMessage(
  id: string,
  input: { status?: SupportStatus; response?: string | null },
): Promise<SupportMessageDTO> {
  await requireAdmin();
  const store = await getStoreContext();
  const current = await prisma.supportMessage.findUnique({ where: { id, storeId: store.id } });
  if (!current) throw new ApiError(404, "Mensaje no encontrado");

  const response = input.response?.trim() || null;
  const updated = await prisma.supportMessage.update({
    where: { id, storeId: store.id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.response !== undefined
        ? {
            response,
            // La fecha de respuesta se fija la primera vez que se escribe una.
            respondedAt: response ? (current.respondedAt ?? new Date()) : null,
          }
        : {}),
    },
  });

  // Correo al cliente con la respuesta: solo si hay respuesta nueva o cambió
  // (no se reenvía al re-guardar lo mismo ni al actualizar solo el estado).
  // Best-effort: un fallo de correo no debe tumbar el guardado de la respuesta.
  if (response && response !== current.response) {
    try {
      const mail = buildSupportReplyEmail({
        name: updated.name,
        radicado: updated.radicado,
        kind: updated.kind as SupportKind,
        subject: updated.subject,
        originalMessage: updated.message,
        response,
        appUrl: store.origin,
        branding: (await getCommercialSettings()).branding,
      });
      const { sent } = await sendEmail({ ...mail, to: updated.email });
      if (!sent) {
        console.warn(`[support] respuesta de ${updated.radicado} no enviada por correo`);
      }
    } catch { console.warn("[support] correo de respuesta no disponible"); }
  }

  return toDTO(updated);
}
