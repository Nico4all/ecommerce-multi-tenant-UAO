import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import { createSupportMessage } from "@/lib/server/support";
import { supportApiSchema } from "@/lib/support-form";

/** Endpoint público: lo usan /pqr y /contacto. Permite invitados. */
export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, supportApiSchema);
  const result = await createSupportMessage(body);
  return jsonOk(result, { status: 201 });
});
