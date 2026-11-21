import { z } from "zod";
import { withErrorHandling, jsonOk, parseBody } from "@/lib/server/api-helpers";
import { activatePlatformStore, assertPlatformMutation } from "@/lib/server/platform-stores";

export const POST = withErrorHandling(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  await assertPlatformMutation(request);
  const input = await parseBody(request, z.object({ domainId: z.string().min(1).max(191), confirmDomain: z.literal(true) }).strict());
  return jsonOk(await activatePlatformStore((await context.params).id, input.domainId));
});
