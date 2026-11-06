import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { listAdminUsers, createAdminUser } from "@/lib/server/admin/users";
import { userSchema } from "@/lib/server/admin/schemas";

export const GET = withErrorHandling(async () => {
  return jsonOk(await listAdminUsers());
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, userSchema);
  return jsonOk(await createAdminUser(body), { status: 201 });
});
