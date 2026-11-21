import { verifyWompiEvent, wompiEnvironment, fetchWompiTransaction, applyWompiWebhookTransaction } from "@/lib/server/wompi";
import { createWompiWebhookHandler } from "@/lib/server/wompi-webhook";

export const POST = createWompiWebhookHandler({
  verify: (event) => verifyWompiEvent(event), environment: wompiEnvironment,
  load: fetchWompiTransaction, apply: applyWompiWebhookTransaction,
});
