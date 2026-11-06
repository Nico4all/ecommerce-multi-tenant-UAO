import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
  ApiError,
} from "@/lib/server/api-helpers";
import { hashPassword, createSession } from "@/lib/server/auth";
import { mergeGuestCart } from "@/lib/server/carts";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre completo"),
  email: z.email("Correo inválido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  // El checkbox de Términos/Datos personales es obligatorio: sin marcar, el
  // formulario ni siquiera debería enviarse, pero el servidor lo exige también.
  acceptedTerms: z.literal(
    true,
    "Debes aceptar los Términos y la Política de datos personales",
  ),
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, schema);

  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new ApiError(409, "Ya existe una cuenta con ese correo");

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: "CUSTOMER",
      termsAcceptedAt: new Date(),
    },
  });

  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "CUSTOMER" as const,
  };
  await createSession(session);
  await mergeGuestCart(user.id);

  return jsonOk(session, { status: 201 });
});
