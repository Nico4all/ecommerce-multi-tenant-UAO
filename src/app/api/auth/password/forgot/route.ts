import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";

const schema = z.object({
  email: z.email("Correo inválido").trim().toLowerCase(),
});

const WINDOW = 15 * 60 * 1000; // 15 minutos

/**
 * Pide un enlace de recuperación. Responde 200 siempre, exista o no la cuenta:
 * así no se puede usar para averiguar qué correos están registrados.
 *
 * Con límite de tasa por IP y por correo para que nadie inunde el buzón de una
 * persona (email bombing).
 */
export const POST = withErrorHandling(async (req: Request) => {
  const { email } = await parseBody(req, schema);

  // 5 por IP y 3 por correo cada 15 min. Se lanza 429 antes de crear token/enviar.
  const byIp = rateLimit(`forgot:ip:${clientIp(req)}`, 5, WINDOW);
  const byEmail = rateLimit(`forgot:email:${email}`, 3, WINDOW);
  if (!byIp.ok || !byEmail.ok) {
    throw new ApiError(
      429,
      "Demasiados intentos. Espera unos minutos antes de volver a pedirlo.",
    );
  }

  // Base pública configurable: detrás de un dominio/proxy el origin de la
  // petición puede ser un host interno, así que APP_URL manda si está puesto.
  const origin = process.env.APP_URL || new URL(req.url).origin;
  await requestPasswordReset(email, origin);

  return jsonOk({
    message:
      "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.",
  });
});
