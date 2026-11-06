import { z } from "zod";
import type { SupportKind, SupportStatus } from "@/lib/server/support";

/**
 * Esquemas y etiquetas de PQR / Contáctanos.
 *
 * Este módulo NO es `server-only` a propósito: lo usan tanto los formularios
 * (react-hook-form) como el route handler, así cliente y servidor validan con
 * las mismas reglas y no se pueden desincronizar.
 */

export const KIND_LABEL: Record<SupportKind, string> = {
  PETICION: "Petición",
  QUEJA: "Queja",
  RECLAMO: "Reclamo",
  SUGERENCIA: "Sugerencia",
  CONTACTO: "Contacto",
};

export const KIND_HINT: Record<SupportKind, string> = {
  PETICION: "Pido información, un documento o un trámite",
  QUEJA: "Estoy inconforme con la atención o el servicio",
  RECLAMO: "Un producto o un pedido llegó mal o no llegó",
  SUGERENCIA: "Tengo una idea para que mejoren",
  CONTACTO: "Mensaje general",
};

export const STATUS_LABEL: Record<SupportStatus, string> = {
  NUEVO: "Nuevo",
  EN_PROCESO: "En proceso",
  RESUELTO: "Resuelto",
  CERRADO: "Cerrado",
};

/** Tipos que puede elegir el cliente en el formulario de PQR (sin CONTACTO). */
export const PQR_KINDS = [
  "PETICION",
  "QUEJA",
  "RECLAMO",
  "SUGERENCIA",
] as const;

const contactFields = {
  name: z.string().trim().min(3, "Escribe tu nombre completo"),
  email: z.email("Escribe un correo válido"),
  phone: z.string().trim(),
  subject: z.string().trim().min(5, "Resume tu solicitud en una frase"),
  message: z
    .string()
    .trim()
    .min(20, "Cuéntanos con detalle: mínimo 20 caracteres")
    .max(4000, "El mensaje es demasiado largo"),
};

export const contactFormSchema = z.object(contactFields);
export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const pqrFormSchema = z.object({
  ...contactFields,
  kind: z.enum(PQR_KINDS),
  docId: z.string().trim(),
  orderCode: z.string().trim(),
});
export type PqrFormValues = z.infer<typeof pqrFormSchema>;

/** Lo que acepta POST /api/support. */
export const supportApiSchema = z.object({
  kind: z.enum(["PETICION", "QUEJA", "RECLAMO", "SUGERENCIA", "CONTACTO"]),
  name: z.string().trim().min(3, "Escribe tu nombre completo"),
  email: z.email("Escribe un correo válido"),
  phone: z.string().trim().nullable().optional(),
  docId: z.string().trim().nullable().optional(),
  orderCode: z.string().trim().nullable().optional(),
  subject: z.string().trim().min(5, "Resume tu solicitud en una frase"),
  message: z.string().trim().min(20).max(4000),
});
