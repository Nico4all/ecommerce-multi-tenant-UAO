import { BannersManager } from "@/components/admin/banners-manager";
import { listAdminBanners } from "@/lib/server/admin/banners";
import { listHomeSections } from "@/lib/server/admin/home-sections";

export default async function AdminBannersPage() {
  const [banners, sections] = await Promise.all([
    listAdminBanners(),
    listHomeSections(),
  ]);
  return <BannersManager banners={banners} sections={sections} />;
}
