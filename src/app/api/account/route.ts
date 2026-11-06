import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import { requireUser, createSession } from "@/lib/server/auth";
import { getProfile, updateProfile } from "@/lib/server/account";

const addressSchema = z.object({
  street: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  zip: z.string().trim().min(1),
  country: z.string().trim().min(1),
});

const schema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre completo"),
  phone: z.string().trim().optional(),
  // `null` borra la dirección; ausente la deja igual.
  address: addressSchema.nullable().optional(),
});

/** Perfil del usuario logueado. */
export const GET = withErrorHandling(async () => {
  const session = await requireUser();
  const profile = await getProfile(session.id);
  if (!profile) throw new ApiError(404, "Usuario no encontrado");
  return jsonOk(profile);
});

/** Actualiza el perfil propio y refresca la sesión (el nombre va en la cookie). */
export const PATCH = withErrorHandling(async (req: Request) => {
  const session = await requireUser();
  const body = await parseBody(req, schema);
  const profile = await updateProfile(session.id, body);

  // La sesión lleva el nombre embebido: se re-emite para que la UI lo refleje.
  await createSession({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
  });

  return jsonOk(profile);
});
