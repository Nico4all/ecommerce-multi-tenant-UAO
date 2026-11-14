"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoryIcon, CATEGORY_ICON_OPTIONS } from "@/components/category-icon";
import { CategoryVisual } from "@/components/category-visual";
import { ImageUploader } from "@/components/admin/image-uploader";

export interface AdminCategory {
  slug: string;
  name: string;
  icon: string;
  gradient: string;
  imageUrl: string | null;
  count: number;
}

const gradientPresets = [
  { label: "Azul", value: "from-sky-500/15 to-blue-600/15 text-blue-700 dark:text-blue-300" },
  { label: "Rosa", value: "from-pink-500/15 to-rose-600/15 text-rose-700 dark:text-rose-300" },
  { label: "Ámbar", value: "from-amber-400/15 to-yellow-600/15 text-amber-700 dark:text-amber-300" },
  { label: "Esmeralda", value: "from-emerald-500/15 to-teal-600/15 text-emerald-700 dark:text-emerald-300" },
  { label: "Fucsia", value: "from-fuchsia-500/15 to-purple-600/15 text-fuchsia-700 dark:text-fuchsia-300" },
  { label: "Lima", value: "from-lime-500/15 to-green-600/15 text-lime-700 dark:text-lime-300" },
  { label: "Naranja", value: "from-orange-500/15 to-red-600/15 text-orange-700 dark:text-orange-300" },
  { label: "Cian", value: "from-cyan-500/15 to-indigo-600/15 text-cyan-700 dark:text-cyan-300" },
];

const emptyForm = {
  name: "",
  slug: "",
  icon: "package",
  gradient: gradientPresets[0].value,
  imageUrl: "",
};

export function CategoriesManager({
  categories,
}: {
  categories: AdminCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isEdit, setIsEdit] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const openNew = () => {
    setIsEdit(false);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (c: AdminCategory) => {
    setIsEdit(true);
    setForm({
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      gradient: c.gradient,
      imageUrl: c.imageUrl ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        icon: form.icon,
        gradient: form.gradient,
        imageUrl: form.imageUrl || null,
      };
      if (isEdit) {
        await api.patch(`/api/admin/categories/${form.slug}`, payload);
        toast.success("Categoría actualizada");
      } else {
        await api.post("/api/admin/categories", { ...payload, slug: form.slug });
        toast.success("Categoría creada");
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo guardar la categoría",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: AdminCategory) => {
    setDeleting(c.slug);
    try {
      await api.delete(`/api/admin/categories/${c.slug}`);
      toast.success(`Categoría "${c.name}" eliminada`);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : "No se pudo eliminar la categoría",
      );
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            Categorías
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {categories.length} categorías del catálogo
          </p>
        </div>
        <Button className="h-9 gap-2" onClick={openNew}>
          <Plus className="size-4" />
          Nueva categoría
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.slug} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <CategoryVisual
                      category={c}
                      className="size-9 rounded-lg"
                      iconClassName="size-4"
                    />
                    <span className="font-medium">{c.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {c.slug}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(c)}
                      aria-label="Editar"
                      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      aria-label="Eliminar"
                      onClick={() => remove(c)}
                      disabled={deleting !== null}
                      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      {deleting === c.slug ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Formulario alta/edición */}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* max-w-lg: con el recortador dentro, `md` (448px) queda apretado. */}
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar categoría" : "Nueva categoría"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Actualiza los datos de la categoría."
                : "Crea una nueva categoría para organizar productos."}
            </DialogDescription>
          </DialogHeader>

          {/* Vista previa en vivo */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <CategoryVisual
              category={{
                name: form.name || "Categoría",
                icon: form.icon,
                gradient: form.gradient,
                imageUrl: form.imageUrl || null,
              }}
              className="size-14 rounded-full ring-1 ring-border"
              iconClassName="size-6"
            />
            <div className="min-w-0">
              <p className="truncate font-heading font-semibold">
                {form.name || "Nombre de la categoría"}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                /category/{form.slug || "slug"}
              </p>
            </div>
          </div>

          <div className="space-y-4 py-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">Nombre</Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Electrónica"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-slug">Slug</Label>
                <Input
                  id="cat-slug"
                  value={form.slug}
                  onChange={(e) => set({ slug: e.target.value })}
                  placeholder="electronica"
                  className="font-mono"
                  disabled={isEdit}
                />
              </div>
            </div>

            {/* Selector visual de icono */}
            <div className="space-y-1.5">
              <Label>Icono</Label>
              <div
                className={cn(
                  "grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-10",
                  form.imageUrl && "pointer-events-none opacity-40",
                )}
              >
                {CATEGORY_ICON_OPTIONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={`Icono ${name}`}
                    aria-pressed={form.icon === name}
                    onClick={() => set({ icon: name })}
                    className={cn(
                      "grid aspect-square place-items-center rounded-md border transition-colors",
                      form.icon === name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <CategoryIcon name={name} className="size-4" />
                  </button>
                ))}
              </div>
              {form.imageUrl ? (
                <p className="text-xs text-muted-foreground">
                  Estás usando una imagen propia; el icono queda de respaldo.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Elige el icono que representa la categoría.
                </p>
              )}
            </div>

            {/* Imagen propia */}
            <div className="space-y-1.5">
              <Label>O usa tu propia imagen</Label>
              {/* Sin ancho máximo: el recortador necesita sitio para su recuadro
                  y sus botones. Antes iba dentro de un max-w-44 y se salían. */}
              <ImageUploader
                value={form.imageUrl}
                onChange={(url) => set({ imageUrl: url })}
                target="category"
              />
              <p className="text-xs text-muted-foreground">
                Se muestra en lugar del icono; sale en un círculo, así que va
                mejor cuadrada. Déjalo vacío para usar el icono. Si tu imagen es
                un SVG, pégalo con &ldquo;o pega una URL&rdquo;.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {gradientPresets.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    aria-label={g.label}
                    aria-pressed={form.gradient === g.value}
                    onClick={() => set({ gradient: g.value })}
                    className={cn(
                      "grid size-9 place-items-center rounded-full bg-gradient-to-br ring-2 ring-offset-2 ring-offset-background transition-all",
                      g.value,
                      form.gradient === g.value ? "ring-primary" : "ring-transparent hover:ring-border",
                    )}
                  >
                    {form.gradient === g.value && <Check className="size-4" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Descripción (opcional)</Label>
              <Textarea
                id="cat-desc"
                rows={2}
                placeholder="Breve descripción que ayuda a organizar el catálogo."
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose className={cn(buttonVariants({ variant: "outline" }))}>
              Cancelar
            </DialogClose>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
