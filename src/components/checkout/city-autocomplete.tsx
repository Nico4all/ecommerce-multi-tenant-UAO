"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * Campo de ciudad con sugerencias propias (no el `datalist` nativo, que muchos
 * navegadores no muestran bien). Al enfocar o escribir aparece un desplegable
 * con las ciudades del departamento; igual acepta texto libre, así que nadie
 * queda bloqueado si su municipio no está en la lista.
 */
export function CityAutocomplete({
  id,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const term = value.trim().toLowerCase();
  const filtered = options.filter((o) => o.toLowerCase().includes(term));
  // Se oculta si la única coincidencia es exactamente lo escrito (ya lo eligió).
  const exact = filtered.length === 1 && filtered[0].toLowerCase() === term;
  const matches = filtered.slice(0, 10); // no abrumar con cientos de ciudades
  const showList = open && matches.length > 0 && !exact;

  return (
    <div ref={ref} className="relative">
      <Input
        id={id}
        required={required}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder={placeholder}
      />
      {showList && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg">
          {matches.map((o) => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // no quitar foco antes del click
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
