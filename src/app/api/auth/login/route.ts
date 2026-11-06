import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import { verifyPassword, createSession } from "@/lib/server/auth";
import { mergeGuestCart } from "@/lib/server/carts";

const schema = z.object({
  email: z.email("Correo inválido").trim().toLowerCase(),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, schema);

  const user = await prisma.user.findUnique({ where: { email: body.email } });

  // Cuentas viejas creadas con Google (ese login ya no existe): no tienen
  // contraseña que acertar. Decirlo evita que el cliente pelee con una
  // "contraseña incorrecta" que nunca existió, y lo manda a crearse una.
  // (El registro ya revela con un 409 si un correo tiene cuenta, así que esto
  // no filtra nada nuevo.)
  if (user && !user.passwordHash) {
    throw new ApiError(
      409,
      "Esta cuenta aún no tiene contraseña. Usa “¿Olvidaste tu contraseña?” para crear una.",
    );
  }

  const valid =
    user?.passwordHash && (await verifyPassword(body.password, user.passwordHash));
  if (!user || !valid) {
    throw new ApiError(401, "Correo o contraseña incorrectos");
  }
  if (user.status === "INACTIVE") {
    throw new ApiError(403, "Tu cuenta está desactivada. Contacta a soporte.");
  }

  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as "ADMIN" | "CUSTOMER",
  };
  await createSession(session);
  await mergeGuestCart(user.id);

  return jsonOk(session);
});
