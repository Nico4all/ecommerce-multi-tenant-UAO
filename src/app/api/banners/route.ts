import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getHomeBanners } from "@/lib/server/banners";

export const GET = withErrorHandling(async () => {
  return jsonOk(await getHomeBanners());
});
