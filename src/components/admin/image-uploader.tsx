"use client";

import * as React from "react";
import {
  UploadCloud,
  Loader2,
  X,
  Link2,
  ImageIcon,
  AlertCircle,
  Crop,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ImageCropper } from "@/components/admin/image-cropper";
import { uploadImage } from "@/lib/image-upload";
import {
  ACCEPT_ATTR,
  ACCEPTED_MIME,
  IMAGE_TARGETS,
  MAX_INPUT_BYTES,
  formatBytes,
  type CropArea,
  type ImageTarget,
} from "@/lib/image-limits";

/**
 * Subidor de imágenes del panel.
 *
 * Arrastra un archivo o abre el explorador. Si el hueco recorta para llenar, se
 * abre el recortador con su proporción exacta, así lo que encuadras es lo que se
 * ve. La imagen se comprime en el navegador y en la BD solo se guarda la ruta
 * que devuelve la API. Se mantiene la opción de pegar una URL, porque las
 * imágenes que ya existen en la tienda son externas.
 */
export function ImageUploader({
  value,
  onChange,
  target,
  className,
}: {
  /** URL actual (subida o externa). Vacío = sin imagen. */
  value: string;
  onChange: (url: string) => void;
  /** Hueco donde se va a ver: fija proporción, tamaño y calidad. */
  target: ImageTarget;
  className?: string;
}) {
  const spec = IMAGE_TARGETS[target];
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [pending, setPending] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<{ from: number; to: number } | null>(null);
  const [urlMode, setUrlMode] = React.useState(false);

  const send = async (file: File, crop?: CropArea) => {
    setError(null);
    setSaved(null);
    setBusy(true);
    try {
      const image = await uploadImage(file, spec.preset, crop);
      onChange(image.url);
      setSaved({ from: image.originalBytes, to: image.bytes });
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  };

  /** Valida antes de abrir el recortador: no tiene sentido encuadrar un PDF. */
  const pick = (file: File) => {
    setError(null);
    setSaved(null);
    if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
      setError("Formato no admitido. Usa JPG, PNG, WebP o AVIF.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError(
        `La imagen pesa ${formatBytes(file.size)}. El máximo es ${formatBytes(MAX_INPUT_BYTES)}.`,
      );
      return;
    }
    if (spec.crop) setPending(file);
    else void send(file);
  };

  const clear = () => {
    onChange("");
    setSaved(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Mientras se encuadra, el recortador ocupa el sitio del dropzone.
  if (pending) {
    return (
      <div className={cn("space-y-2", className)}>
        <ImageCropper
          file={pending}
          aspect={spec.aspect}
          hint={spec.hint}
          onCancel={() => setPending(null)}
          onConfirm={(area) => void send(pending, area)}
        />
        {busy && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            Subiendo…
          </p>
        )}
        {error && (
          <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div
          className="group relative overflow-hidden rounded-lg border border-border bg-muted/30"
          style={{ aspectRatio: spec.aspect }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ruta subida o URL externa del admin */}
          <img
            src={value}
            alt="Vista previa"
            className="size-full object-cover"
            onError={() => setError("No se pudo cargar la imagen desde esa URL")}
          />
          <button
            type="button"
            onClick={clear}
            aria-label="Quitar imagen"
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white opacity-100 transition-opacity hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) pick(file);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          style={{ aspectRatio: Math.min(spec.aspect, 2.5) }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/60 hover:bg-accent/40",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="mt-2 text-sm font-medium">Subiendo…</p>
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
                {dragging ? "Suelta la imagen aquí" : "Arrastra una imagen o haz clic"}
              </p>
              <p className="mt-0.5 text-xs font-medium text-primary">
                Ideal: {spec.size}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                JPG, PNG, WebP o AVIF · hasta {formatBytes(MAX_INPUT_BYTES)}
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) pick(file);
        }}
      />

      {/* El tamaño ideal también se ve con la imagen ya puesta, para reemplazarla. */}
      {value && !error && !saved && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Crop className="size-3.5" />
          Ideal: {spec.size}
        </p>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {saved && !error && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5 text-primary" />
          Comprimida de {formatBytes(saved.from)} a{" "}
          <strong className="text-foreground">{formatBytes(saved.to)}</strong>
        </p>
      )}

      {/* Alternativa: pegar una URL externa, como se hacía hasta ahora. */}
      {urlMode ? (
        <Input
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setUrlMode(false)}
          placeholder="https://…/imagen.webp"
        />
      ) : (
        <button
          type="button"
          onClick={() => setUrlMode(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <Link2 className="size-3.5" />
          o pega una URL
        </button>
      )}
    </div>
  );
}
