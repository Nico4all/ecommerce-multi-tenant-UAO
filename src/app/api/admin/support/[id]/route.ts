import { z } from "zod";
import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { updateSupportMessage } from "@/lib/server/support";

const schema = z.object({
  status: z.enum(["NUEVO", "EN_PROCESO", "RESUELTO", "CERRADO"]).optional(),
  response: z.string().trim().max(4000).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  return jsonOk(await updateSupportMessage(id, body));
});
