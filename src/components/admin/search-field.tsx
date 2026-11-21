"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Buscador de una tabla del panel.
 *
 * Estaba copiado cinco veces con los mismos tres defectos: el campo no tenía
 * etiqueta (solo marcador de posición, que desaparece al escribir y no lo
 * anuncia el lector de pantalla), llevaba `outline-none` y nadie dibujaba el
 * anillo de foco en su lugar, así que al tabular hasta él no se veía nada.
 *
 * El anillo va en la caja y no en el campo: lo que se ve como control es el
 * recuadro con la lupa dentro, no el `input` suelto.
 */
export function SearchField({
  label,
  value,
  onChange,
  className,
  fieldClassName,
  ...inputProps
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  /** Qué se busca aquí. Va oculto salvo para el lector de pantalla. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Clases de la caja con borde. */
  fieldClassName?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div
        className={cn(
          "flex h-9 items-center rounded-md border border-border bg-background px-3 transition-shadow focus-within:ring-2 focus-within:ring-ring",
          fieldClassName,
        )}
      >
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          id={id}
          // `search` da el botón de limpiar del navegador, que en un filtro se
          // agradece más que borrar a pulsos de retroceso.
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
          {...inputProps}
        />
      </div>
    </div>
  );
}
