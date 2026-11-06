import { DiscountsManager } from "@/components/admin/discounts-manager";
import { listAdminDiscounts } from "@/lib/server/admin/discounts";

export default async function AdminDiscountsPage() {
  const codes = await listAdminDiscounts();
  return <DiscountsManager codes={codes} />;
}
