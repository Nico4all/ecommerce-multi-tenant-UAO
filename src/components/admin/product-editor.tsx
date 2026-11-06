"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  Trash2,
  ImagePlus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormSelect } from "@/components/admin/form-select";
import { ProductImagesUploader } from "@/components/admin/product-images-uploader";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/shipping";
import { api, ApiClientError } from "@/lib/api-client";
import type { AdminProductDetail } from "@/lib/server/admin/products";
import type { Category, CategorySlug } from "@/types";

interface Spec {
  id: number;
  key: string;
  value: string;
}

interface VariantRow {
  id: number;
  name: string;
  colorHex: string;
  stock: string;
}

/** Convierte un nombre en slug URL-safe. */
function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ProductEditor({
  product,
  categories,
}: {
  product?: AdminProductDetail;
  categories: Category[];
}) {
  const router = useRouter();
  const isNew = !product;

  const [form, setForm] = React.useState({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    brand: product?.brand ?? "",
    description: product?.description ?? "",
    categorySlug: product?.category ?? "",
    price: product ? String(product.price) : "",
    offerPrice: product?.offerPrice !== null && product?.offerPrice !== undefined
      ? String(product.offerPrice)
      : "",
    offerActive: product?.offerActive ?? false,
    cost: product?.cost !== null && product?.cost !== undefined
      ? String(product.cost)
      : "",
    stock: product ? String(product.stock) : "0",
    sku: product?.sku ?? "",
    status: product?.status ?? "PUBLISHED",
    featured: product?.featured ?? false,
    shippingCost:
      product?.shippingCost !== null && product?.shippingCost !== undefined
        ? String(product.shippingCost)
        : "",
    badge: product?.badge ?? "",
  });
  const [images, setImages] = React.useState<string[]>(product?.images ?? []);
  const [specs, setSpecs] = React.useState<Spec[]>(
    product?.specs.length
      ? product.specs.map((s, i) => ({ id: i + 1, key: s.key, value: s.value }))
      : [{ id: 1, key: "", value: "" }],
  );
  const nextId = React.useRef(specs.length + 1);
  const [variants, setVariants] = React.useState<VariantRow[]>(
    product?.variants.map((v, i) => ({
      id: i + 1,
      name: v.name,
      colorHex: v.colorHex ?? "#10b981",
      stock: String(v.stock),
    })) ?? [],
  );
  const nextVariantId = React.useRef(variants.length + 1);

  /** Con al menos un color con nombre, el stock lo llevan los colores. */
  const usaColores = variants.some((v) => v.name.trim() !== "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Ganancia por unidad en vivo: precio de venta vigente (oferta si está activa)
  // menos el costo. Solo se muestra si hay costo cargado.
  const priceNum = Number(form.price) || 0;
  const offerNum = Number(form.offerPrice) || 0;
  const salePrice = form.offerActive && offerNum > 0 ? offerNum : priceNum;
  const unitProfit = form.cost.trim() ? salePrice - (Number(form.cost) || 0) : null;
  const marginPct =
    unitProfit !== null && salePrice > 0
      ? Math.round((unitProfit / salePrice) * 100)
      : null;

  const addSpec = () =>
    setSpecs((s) => [...s, { id: nextId.current++, key: "", value: "" }]);
  const removeSpec = (id: number) => setSpecs((s) => s.filter((x) => x.id !== id));
  const updateSpec = (id: number, patch: Partial<Spec>) =>
    setSpecs((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const addVariant = () =>
    setVariants((v) => [
      ...v,
      { id: nextVariantId.current++, name: "", colorHex: "#10b981", stock: "0" },
    ]);
  const removeVariant = (id: number) =>
    setVariants((v) => v.filter((x) => x.id !== id));
  const updateVariant = (id: number, patch: Partial<VariantRow>) =>
    setVariants((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async () => {
    setError(null);
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      brand: form.brand,
      description: form.description || undefined,
      categorySlug: form.categorySlug,
      price: Number(form.price),
      offerPrice: form.offerPrice ? Number(form.offerPrice) : null,
      offerActive: form.offerActive && !!form.offerPrice,
      cost: form.cost ? Number(form.cost) : null,
      // Con colores, el stock general se guarda en 0: el bueno vive en cada
      // color y dejar aquí un número viejo solo confunde al leer la ficha.
      stock: usaColores ? 0 : Number(form.stock) || 0,
      sku: form.sku || null,
      status: form.status as "PUBLISHED" | "DRAFT" | "ARCHIVED",
      featured: form.featured,
      // Vacío => null (tarifa general). "0" => 0 (envío gratis).
      shippingCost: form.shippingCost.trim() === "" ? null : Number(form.shippingCost),
      badge: form.badge || null,
      specs: specs
        .filter((s) => s.key.trim() && s.value.trim())
        .map((s) => ({ key: s.key, value: s.value })),
      variants: variants
        .filter((v) => v.name.trim())
        .map((v) => ({
          name: v.name,
          colorHex: v.colorHex || null,
          stock: Number(v.stock) || 0,
        })),
      images,
    };
    try {
      if (isNew) {
        await api.post("/api/admin/products", payload);
        toast.success("Producto creado");
      } else {
        await api.patch(`/api/admin/products/${product.id}`, payload);
        toast.success("Cambios guardados");
      }
      router.push("/admin/products");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.message : "No se pudo guardar el producto",
      );
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div>
      {/* Barra de acciones */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            aria-label="Volver"
            className="grid size-9 place-items-center rounded-md border border-border hover:bg-accent"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight">
              {isNew ? "Nuevo producto" : "Editar producto"}
            </h1>
            {product && (
              <p className="text-sm text-muted-foreground">{product.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/products"
            className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          >
            Cancelar
          </Link>
          <Button className="h-9 gap-1.5" onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-4 lg:col-span-2">
          {/* Información general */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-heading font-semibold">Información general</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre del producto</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Ej. Audífonos inalámbricos Pro"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="brand">Marca</Label>
                  <Input
                    id="brand"
                    value={form.brand}
                    onChange={(e) => set({ brand: e.target.value })}
                    placeholder="Ej. Nike"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Slug (URL)</Label>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => set({ slug: e.target.value })}
                    placeholder={slugify(form.name) || "audifonos-inalambricos-pro"}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Describe el producto, sus beneficios y características principales…"
                />
                <p className="text-xs text-muted-foreground">
                  Aparece en la página de detalle del producto.
                </p>
              </div>
            </div>
          </section>

          {/* Especificaciones */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading font-semibold">Especificaciones</h2>
              <Button variant="outline" size="sm" className="gap-1" onClick={addSpec}>
                <Plus className="size-3.5" />
                Añadir
              </Button>
            </div>
            <div className="space-y-2">
              {specs.map((spec) => (
                <div key={spec.id} className="flex items-center gap-2">
                  <Input
                    value={spec.key}
                    onChange={(e) => updateSpec(spec.id, { key: e.target.value })}
                    placeholder="Atributo (ej. Material)"
                    className="flex-1"
                  />
                  <Input
                    value={spec.value}
                    onChange={(e) => updateSpec(spec.id, { value: e.target.value })}
                    placeholder="Valor (ej. Aluminio)"
                    className="flex-1"
                  />
                  <button
                    onClick={() => removeSpec(spec.id)}
                    aria-label="Eliminar especificación"
                    className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {specs.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sin especificaciones. Añade la primera.
                </p>
              )}
            </div>
          </section>

          {/* Colores / variantes */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-heading font-semibold">Colores (opcional)</h2>
              <Button variant="outline" size="sm" className="gap-1" onClick={addVariant}>
                <Plus className="size-3.5" />
                Añadir color
              </Button>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Si el producto viene en varios colores, agrégalos aquí con su
              stock. Si no maneja colores, deja esta sección vacía.
            </p>
            <div className="space-y-2">
              {variants.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <label
                    className="relative grid size-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-border"
                    title="Elegir color"
                  >
                    <span
                      className="absolute inset-1 rounded"
                      style={{ backgroundColor: v.colorHex }}
                    />
                    <input
                      type="color"
                      value={v.colorHex}
                      onChange={(e) => updateVariant(v.id, { colorHex: e.target.value })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-label="Color"
                    />
                  </label>
                  <Input
                    value={v.name}
                    onChange={(e) => updateVariant(v.id, { name: e.target.value })}
                    placeholder="Nombre (ej. Verde bosque)"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={v.stock}
                    onChange={(e) => updateVariant(v.id, { stock: e.target.value })}
                    placeholder="Stock"
                    className="w-24 text-right tabular-nums"
                    aria-label="Stock del color"
                  />
                  <button
                    onClick={() => removeVariant(v.id)}
                    aria-label="Eliminar color"
                    className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {variants.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
                  Este producto no maneja colores.
                </p>
              )}
            </div>
          </section>

          {/* Fotos */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 font-heading font-semibold">Fotos</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {images.length > 0
                ? "La primera es la que sale en el catálogo. Reordénalas con las flechas."
                : "Sin fotos, la tienda muestra el mosaico de la categoría."}
            </p>
            <ProductImagesUploader value={images} onChange={setImages} />
          </section>
        </div>

        {/* Aside */}
        <aside className="space-y-4">
          {/* Estado */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-heading font-semibold">Estado</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="status">Visibilidad</Label>
                <FormSelect
                  id="status"
                  value={form.status}
                  onChange={(v) => set({ status: v as typeof form.status })}
                  options={[
                    { value: "PUBLISHED", label: "Publicado" },
                    { value: "DRAFT", label: "Borrador" },
                    { value: "ARCHIVED", label: "Archivado" },
                  ]}
                />
              </div>
              <label className="flex items-center justify-between">
                <span className="text-sm">Producto destacado</span>
                <Switch
                  checked={form.featured}
                  onCheckedChange={(v) => set({ featured: v === true })}
                />
              </label>
            </div>
          </section>

          {/* Organización */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-heading font-semibold">Organización</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="category">Categoría</Label>
                <FormSelect
                  id="category"
                  value={form.categorySlug}
                  onChange={(v) => set({ categorySlug: v })}
                  placeholder="Selecciona una categoría"
                  options={categories.map((c) => ({
                    value: c.slug,
                    label: c.name,
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="badge">Etiqueta (badge)</Label>
                <Input
                  id="badge"
                  value={form.badge}
                  onChange={(e) => set({ badge: e.target.value })}
                  placeholder="Ej. Más vendido"
                />
              </div>
            </div>
          </section>

          {/* Precio e inventario */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-heading font-semibold">Precio e inventario</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Precio base</Label>
                  <Input
                    id="price"
                    type="number"
                    value={form.price}
                    onChange={(e) => set({ price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="offerPrice">Precio de oferta</Label>
                  <Input
                    id="offerPrice"
                    type="number"
                    value={form.offerPrice}
                    onChange={(e) => set({ offerPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <label className="flex items-center justify-between">
                <span className="text-sm">Oferta activa</span>
                <Switch
                  checked={form.offerActive}
                  onCheckedChange={(v) => set({ offerActive: v === true })}
                />
              </label>

              <div className="space-y-1.5 rounded-lg border border-dashed border-border p-3">
                <Label htmlFor="cost">Precio de costo</Label>
                <Input
                  id="cost"
                  type="number"
                  value={form.cost}
                  onChange={(e) => set({ cost: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Lo que te cuesta el producto. Es interno: no se muestra en la tienda,
                  solo sirve para calcular tus ganancias.
                </p>
                {unitProfit !== null && (
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      unitProfit >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    Ganancia por unidad: {formatPrice(unitProfit)}
                    {marginPct !== null ? ` · ${marginPct}% de margen` : ""}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 rounded-lg border border-dashed border-border p-3">
                <Label htmlFor="shippingCost">Costo de envío</Label>
                <Input
                  id="shippingCost"
                  type="number"
                  value={form.shippingCost}
                  onChange={(e) => set({ shippingCost: e.target.value })}
                  placeholder={`Vacío = tarifa general (${formatPrice(SHIPPING_COST)})`}
                />
                <p className="text-xs text-muted-foreground">
                  Déjalo <strong>vacío</strong> para usar la tarifa general de la
                  tienda (gratis desde {formatPrice(FREE_SHIPPING_THRESHOLD)}).
                  Pon <strong>0</strong> para que este producto siempre tenga
                  envío gratis, o un monto fijo si es voluminoso o pesado.
                </p>
                {form.shippingCost.trim() !== "" && (
                  <p className="text-xs font-semibold text-primary">
                    {Number(form.shippingCost) === 0
                      ? "Este producto se envía gratis siempre."
                      : `Envío fijo de ${formatPrice(Number(form.shippingCost) || 0)} para el pedido.`}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stock">Stock</Label>
                  {/* Con colores cargados este campo no se usa: la venta
                      descuenta del stock de cada color. Se bloquea para que
                      nadie llene los dos y crea que el de aquí es el bueno. */}
                  <Input
                    id="stock"
                    type="number"
                    value={usaColores ? "" : form.stock}
                    onChange={(e) => set({ stock: e.target.value })}
                    placeholder={usaColores ? "Lo llevan los colores" : "0"}
                    disabled={usaColores}
                    aria-describedby={usaColores ? "stock-ayuda" : undefined}
                  />
                  {usaColores && (
                    <p id="stock-ayuda" className="text-xs text-muted-foreground">
                      Este producto maneja colores: el stock de cada uno se
                      edita arriba, y es de ahí de donde se descuenta al vender.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={form.sku}
                    onChange={(e) => set({ sku: e.target.value })}
                    placeholder="VLP-0000"
                  />
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Guardar (móvil) */}
      <div className="mt-6 flex justify-end gap-2 lg:hidden">
        <Link
          href="/admin/products"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Guardar producto
        </Button>
      </div>
    </div>
  );
}
