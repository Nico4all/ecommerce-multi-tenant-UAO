"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Pencil, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormSelect } from "@/components/admin/form-select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProductImage } from "@/components/product/product-image";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatPrice } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import type { AdminProductRow } from "@/lib/server/admin/products";
import type { Category, CategorySlug } from "@/types";

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "publicado",
  DRAFT: "borrador",
  ARCHIVED: "inactivo",
};

export function ProductsTable({
  products,
  categories,
}: {
  products: AdminProductRow[];
  categories: Category[];
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<string>("all");
  const [toDelete, setToDelete] = React.useState<AdminProductRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const filtered = products.filter((p) => {
    const matchesQ =
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.brand.toLowerCase().includes(q.toLowerCase());
    const matchesCat = cat === "all" || p.category === cat;
    return matchesQ && matchesCat;
  });

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/products/${toDelete.id}`);
      toast.success(`"${toDelete.name}" eliminado`);
      setToDelete(null);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo eliminar el producto",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex h-9 flex-1 items-center rounded-md border border-border bg-background px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o marca…"
            className="h-full flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <FormSelect
          value={cat}
          onChange={(v) => setCat(v || "all")}
          className="w-full sm:w-52"
          options={[
            { value: "all", label: "Todas las categorías" },
            ...categories.map((c) => ({ value: c.slug, label: c.name })),
          ]}
        />
      </div>

      <div className="overflow-x-auto border-t border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <ProductImage
                      src={p.imageUrl}
                      category={p.category as CategorySlug}
                      name={p.name}
                      className="size-10 shrink-0 rounded-md border border-border"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="line-clamp-1 font-medium hover:text-primary"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{p.brand}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {p.category}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.offerActive && p.offerPrice !== null ? (
                    <span>
                      <span className="font-medium text-deal">
                        {formatPrice(p.offerPrice)}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(p.price)}
                      </span>
                    </span>
                  ) : (
                    formatPrice(p.price)
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    p.stock < 10 && "font-medium text-destructive",
                  )}
                >
                  {p.stock}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={
                      p.stock <= 0
                        ? "agotado"
                        : (STATUS_LABEL[p.status] ?? p.status)
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <Link
                      href={`/admin/products/${p.id}`}
                      aria-label="Editar"
                      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <button
                      aria-label="Eliminar"
                      onClick={() => setToDelete(p)}
                      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <MoreHorizontal className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay productos que coincidan con tu búsqueda.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {filtered.length} de {products.length} productos
        </span>
      </div>

      {/* Confirmación de borrado */}
      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar producto?</DialogTitle>
            <DialogDescription>
              Se eliminará <strong>{toDelete?.name}</strong> del catálogo. Las
              órdenes pasadas conservan su copia. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className={cn(buttonVariants({ variant: "outline" }))}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
