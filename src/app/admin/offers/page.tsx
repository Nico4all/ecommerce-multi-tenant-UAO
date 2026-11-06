import { Info } from "lucide-react";
import { PageHeading } from "@/components/admin/page-heading";
import { OffersManager } from "@/components/admin/offers-manager";
import { listAdminProducts } from "@/lib/server/admin/products";

export default async function AdminOffersPage() {
  const products = await listAdminProducts();

  return (
    <div>
      <PageHeading
        title="Ofertas"
        description="Activa o desactiva ofertas y ajusta el precio con descuento"
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Los productos en oferta muestran el precio tachado y el porcentaje de
          descuento en la tienda, y aparecen en la sección{" "}
          <span className="font-medium text-foreground">Mejores ofertas</span> del
          inicio.
        </p>
      </div>

      <OffersManager products={products} />
    </div>
  );
}
