import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { validateDiscount } from "@/lib/server/discounts";

const schema = z.object({
  code: z.string().trim().min(1, "Escribe un código"),
  subtotal: z.number().min(0),
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, schema);
  return jsonOk(await validateDiscount(body.code, body.subtotal));
});
