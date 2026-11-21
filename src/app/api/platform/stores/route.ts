import { withErrorHandling, jsonOk, parseBody } from "@/lib/server/api-helpers";
import { listPlatformStores, createPlatformStore, platformStoreSchema, assertPlatformMutation } from "@/lib/server/platform-stores";

export const GET = withErrorHandling(async () => jsonOk(await listPlatformStores()));
export const POST = withErrorHandling(async (request: Request) => {
  await assertPlatformMutation(request);
  return jsonOk(await createPlatformStore(await parseBody(request, platformStoreSchema)), { status: 201 });
});
