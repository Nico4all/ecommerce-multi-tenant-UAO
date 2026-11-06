import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { getWishlist, toggleWishlist } from "@/lib/server/wishlist";

export const GET = withErrorHandling(async () => {
  return jsonOk(await getWishlist());
});

const schema = z.object({ productId: z.string().min(1) });

/** Toggle: agrega si no está, quita si ya estaba. Devuelve { added }. */
export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, schema);
  const added = await toggleWishlist(body.productId);
  return jsonOk({ added });
});
