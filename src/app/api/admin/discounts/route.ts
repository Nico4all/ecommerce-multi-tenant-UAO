import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import {
  listAdminDiscounts,
  createDiscount,
} from "@/lib/server/admin/discounts";
import { discountSchema } from "@/lib/server/admin/schemas";

export const GET = withErrorHandling(async () => {
  return jsonOk(await listAdminDiscounts());
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, discountSchema);
  return jsonOk(await createDiscount(body), { status: 201 });
});
