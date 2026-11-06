import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getNotificationFeed } from "@/lib/server/notifications";

/** Feed de la campana. Lo consulta el panel al abrirla y cada minuto. */
export const GET = withErrorHandling(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit")) || 15;
  return jsonOk(await getNotificationFeed(Math.min(Math.max(limit, 1), 50)));
});
