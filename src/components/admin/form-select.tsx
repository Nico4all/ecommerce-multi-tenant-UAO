"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
  /** Adorno opcional a la izquierda (pastilla de color, icono…). */
  adornment?: React.ReactNode;
}

/**
 * Select de formulario.
 *
 * Base UI muestra el VALOR crudo en el trigger salvo que se le pasen los
 * `items` (value → label); sin eso se veían cosas como
 * "section:cmrl6y64…" o "PUBLISHED". Este wrapper centraliza esa
 * configuración, fuerza ancho completo y recorta textos largos.
 */
export function FormSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      items={options.map((o) => ({ value: o.value, label: o.label }))}
      value={value || null}
      onValueChange={(v) => onChange((v as string) ?? "")}
    >
      <SelectTrigger
        id={id}
        disabled={disabled}
        className={cn("w-full min-w-0", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.adornment ? (
              <span className="flex items-center gap-2">
                {o.adornment}
                {o.label}
              </span>
            ) : (
              o.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
