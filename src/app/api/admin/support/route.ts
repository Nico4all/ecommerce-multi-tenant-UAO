import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import {
  listSupportMessages,
  type SupportKind,
  type SupportStatus,
} from "@/lib/server/support";

export const GET = withErrorHandling(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as SupportStatus | null;
  const kind = searchParams.get("kind") as SupportKind | null;
  return jsonOk(
    await listSupportMessages({
      status: status ?? undefined,
      kind: kind ?? undefined,
    }),
  );
});
