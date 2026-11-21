"use client";

import * as React from "react";
import {
  UploadCloud,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Link2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/image-upload";
import {
  ACCEPT_ATTR,
  IMAGE_TARGETS,
  MAX_INPUT_BYTES,
  MAX_PRODUCT_IMAGES,
  formatBytes,
} from "@/lib/image-limits";

/**
 * Galería de fotos del producto.
 *
 * Se pueden arrastrar varias a la vez. El orden es el que verá el cliente y la
 * PRIMERA es la principal: la que sale en el catálogo, el carrito y los avisos.
 * Se reordena con las flechas, igual que las secciones de /admin/home.
 *
 * Aquí no hay recortador a propósito: las fotos de producto se muestran enteras
 * (`object-contain`), así que no se recorta nada y encuadrar de una en una ocho
 * fotos sería un castigo.
 */
export function ProductImagesUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(0);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [urlMode, setUrlMode] = React.useState(false);
  const [url, setUrl] = React.useState("");

  const free = MAX_PRODUCT_IMAGES - value.length;

  const addFiles = async (files: File[]) => {
    setErrors([]);
    if (files.length === 0) return;

    // Se recortan a lo que cabe y se avisa, en vez de subir y descartar luego.
    const accepted = files.slice(0, Math.max(0, free));
    if (files.length > accepted.length) {
      setErrors([
        `Solo caben ${MAX_PRODUCT_IMAGES} fotos: se ignoraron ${files.length - accepted.length}.`,
      ]);
    }
    if (accepted.length === 0) return;

    setBusy(accepted.length);
    const done: string[] = [];
    const failed: string[] = [];

    // En serie a propósito: subir 8 fotos a la vez satura la subida del usuario
    // y hace que todas vayan lentas.
    for (const file of accepted) {
      try {
        const image = await uploadImage(file, "product");
        done.push(image.url);
      } catch (e) {
        failed.push(e instanceof Error ? e.message : `No se pudo subir "${file.name}"`);
      }
      setBusy((n) => n - 1);
    }

    if (done.length) onChange([...value, ...done]);
    if (failed.length) setErrors((prev) => [...prev, ...failed]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  const addUrl = () => {
    const clean = url.trim();
    if (!clean || free <= 0) return;
    onChange([...value, clean]);
    setUrl("");
    setUrlMode(false);
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((src, i) => (
            <li
              key={`${src}-${i}`}
              className="group relative overflow-hidden rounded-lg border border-border bg-white dark:bg-slate-100"
            >
              <div className="aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element -- ruta subida o URL externa del admin */}
                <img src={src} alt="" className="size-full object-contain" />
              </div>

              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                  Principal
                </span>
              )}

              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Quitar foto"
                className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="size-3.5" />
              </button>

              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label="Mover antes"
                  className="grid size-6 place-items-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-0"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === value.length - 1}
                  aria-label="Mover después"
                  className="grid size-6 place-items-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-0"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {free > 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
            value.length === 0 ? "aspect-[16/7]" : "py-8",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/60 hover:bg-accent/40",
          )}
        >
          {busy > 0 ? (
            <>
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="mt-2 text-sm font-medium">
                Subiendo {busy} foto{busy === 1 ? "" : "s"}…
              </p>
            </>
          ) : (
            <>
              <UploadCloud
                className={cn(
                  "size-7",
                  dragging ? "text-primary" : "text-muted-foreground",
                )}
                strokeWidth={1.5}
              />
              <p className="mt-2 text-sm font-medium">
                {dragging
                  ? "Suelta las fotos aquí"
                  : "Arrastra tus fotos o haz clic para elegirlas"}
              </p>
              <p className="mt-0.5 text-xs font-medium text-primary">
                Ideal: {IMAGE_TARGETS.product.size} · {IMAGE_TARGETS.product.hint}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Puedes subir varias a la vez · quedan {free} de {MAX_PRODUCT_IMAGES} ·
                hasta {formatBytes(MAX_INPUT_BYTES)} cada una
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(e) => void addFiles(Array.from(e.target.files ?? []))}
      />

      {errors.map((e, i) => (
        <p
          key={i}
          className="flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {e}
        </p>
      ))}

      {free > 0 &&
        (urlMode ? (
          <div className="flex gap-2">
            <Input
              value={url}
              autoFocus
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
              placeholder="https://…/imagen.webp"
            />
            <Button type="button" variant="outline" onClick={addUrl}>
              Añadir
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setUrlMode(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <Link2 className="size-3.5" />
            o pega una URL
          </button>
        ))}
    </div>
  );
}
