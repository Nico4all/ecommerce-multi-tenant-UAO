import { listSupportMessages } from "@/lib/server/support";
import { SupportInbox } from "@/components/admin/support-inbox";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const messages = await listSupportMessages();
  return (
    <>
      {/* Una PQR nueva entra sola en la bandeja. */}
      <AutoRefresh seconds={20} />
      <SupportInbox messages={messages} />
    </>
  );
}
