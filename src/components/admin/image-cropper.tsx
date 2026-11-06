"use client";

import * as React from "react";
import Cropper from "react-easy-crop";
// Sin esta hoja de estilos la librería pinta la rejilla pero NO la imagen: el
// posicionamiento del <img> vive aquí, no en el JS.
import "react-easy-crop/react-easy-crop.css";
import { ZoomIn, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CropArea } from "@/lib/image-limits";

/**
 * Recortador que sale al elegir una imagen.
 *
 * Va EN LÍNEA, no en un diálogo: dos de los formularios que lo usan (banners y
 * categorías) ya son diálogos, y anidar uno dentro de otro trae problemas de
 * foco. Así funciona igual en los cuatro sitios.
 *
 * El recuadro tiene la proporción exacta del hueco donde se va a ver, así que
 * lo que encuadres aquí es lo que saldrá en la tienda.
 */
export function ImageCropper({
  file,
  aspect,
  hint,
  onCancel,
  onConfirm,
}: {
  file: File;
  aspect: number;
  hint?: string;
  onCancel: () => void;
  onConfirm: (area: CropArea) => void;
}) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [area, setArea] = React.useState<CropArea | null>(null);

  /**
   * URL del blob para previsualizar el archivo.
   *
   * Se crea DENTRO del efecto, no con useMemo: en desarrollo React monta, limpia
   * y vuelve a montar, así que la limpieza revocaba la URL y el segundo montaje
   * reutilizaba una ya muerta (imagen en negro). Creándola aquí, cada montaje
   * tiene la suya y la limpieza solo revoca la que le toca.
   */
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="min-w-0 space-y-3 overflow-hidden rounded-lg border border-border bg-card p-3">
      <div className="relative h-56 overflow-hidden rounded-md bg-slate-900">
        {url ? (
          <Cropper
            image={url}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            showGrid
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Loader2 className="size-5 animate-spin text-white/60" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Arrastra y haz zoom para elegir qué se ve.
        {hint ? ` ${hint}` : ""}
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="crop-zoom" className="flex items-center gap-1.5 text-xs">
          <ZoomIn className="size-3.5" />
          Zoom
        </Label>
        <input
          id="crop-zoom"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* `flex-wrap` + `min-w-0`: si el hueco es estrecho los botones se apilan
          en vez de salirse de la tarjeta. */}
      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="gap-1.5"
        >
          <X className="size-3.5" />
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!area}
          onClick={() => area && onConfirm(area)}
          className="gap-1.5"
        >
          <Check className="size-3.5" />
          Recortar y subir
        </Button>
      </div>
    </div>
  );
}
