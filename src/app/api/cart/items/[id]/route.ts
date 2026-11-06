import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { updateCartItem, removeCartItem } from "@/lib/server/carts";

const schema = z.object({ qty: z.number().int().min(1).max(99) });

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  return jsonOk(await updateCartItem(id, body.qty));
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return jsonOk(await removeCartItem(id));
});
