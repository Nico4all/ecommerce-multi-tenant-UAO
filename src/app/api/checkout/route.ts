import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { checkout } from "@/lib/server/orders";

const schema = z.object({
  contact: z.object({
    name: z.string().trim().min(2, "Escribe el nombre completo"),
    email: z.email("Correo inválido").trim().toLowerCase(),
    phone: z.string().trim().min(7, "Teléfono inválido"),
  }),
  shipping: z.object({
    street: z.string().trim().min(3, "Escribe calle y número"),
    city: z.string().trim().min(2, "Escribe la ciudad"),
    state: z.string().trim().min(2, "Escribe el departamento"),
    zip: z.string().trim().min(3, "Código postal inválido"),
    country: z.string().trim().min(2),
    reference: z.string().trim().optional(),
  }),
  // WOMPI = pasarela en línea; COD = contra entrega (efectivo al recibir).
  method: z.enum(["WOMPI", "COD"]),
  discountCode: z.string().trim().optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, schema);
  const result = await checkout({
    ...body,
    discountCode: body.discountCode || undefined,
  });
  return jsonOk(result, { status: 201 });
});
