import { listPlatformStores } from "@/lib/server/platform-stores";
import { PlatformStoresManager } from "@/components/platform/stores-manager";

export default async function PlatformPage() {
  return <PlatformStoresManager initial={await listPlatformStores()} />;
}
