import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { listAdminBanners, createBanner } from "@/lib/server/admin/banners";
import { bannerSchema } from "@/lib/server/admin/schemas";

export const GET = withErrorHandling(async () => {
  return jsonOk(await listAdminBanners());
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, bannerSchema);
  return jsonOk(await createBanner(body), { status: 201 });
});
