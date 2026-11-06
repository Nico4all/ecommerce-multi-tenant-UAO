import { PageHeading } from "@/components/admin/page-heading";
import { StorageManager } from "@/components/admin/storage-manager";

export default function AdminStoragePage() {
  return (
    <div>
      <PageHeading
        title="Almacenamiento"
        description="Libera espacio eliminando imágenes que ya no usa ningún producto ni banner"
      />
      <StorageManager />
    </div>
  );
}
