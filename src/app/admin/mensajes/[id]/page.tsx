import { notFound } from "next/navigation";
import { getSupportMessage } from "@/lib/server/support";
import { SupportDetail } from "@/components/admin/support-detail";

export default async function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const message = await getSupportMessage(id);
  if (!message) notFound();

  return <SupportDetail message={message} />;
}
