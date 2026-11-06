import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { addToCart } from "@/lib/server/carts";

const schema = z
  .object({
    productId: z.string().optional(),
    slug: z.string().optional(),
    variantId: z.string().optional(),
    qty: z.number().int().min(1).max(99).default(1),
  })
  .refine((v) => v.productId || v.slug, {
    message: "Falta productId o slug",
  });

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, schema);
  return jsonOk(await addToCart(body), { status: 201 });
});
