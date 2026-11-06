import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { submitReview } from "@/lib/server/reviews";

const schema = z.object({
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas").max(5),
  body: z
    .string()
    .trim()
    .min(10, "Cuéntanos un poco más (mínimo 10 caracteres)")
    .max(1000),
});

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const body = await parseBody(req, schema);
    return jsonOk(await submitReview(slug, body), { status: 201 });
  },
);
