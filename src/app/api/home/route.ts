import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getHomeLayout } from "@/lib/server/home";

/** Composición pública de la home (mismas secciones que renderiza la página). */
export const GET = withErrorHandling(async () => {
  return jsonOk(await getHomeLayout());
});
