"use client";

import * as React from "react";
import { MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CITIES, DEFAULT_CITY } from "@/lib/colombia";
import { useLocationStore } from "@/stores/location-store";

/**
 * Selector de ciudad de envío de la barra superior.
 *
 * La elección se guarda en localStorage (Zustand) y el checkout la usa para
 * rellenar la dirección. Hasta que el cliente hidrata se muestra la ciudad por
 * defecto, si no el HTML del servidor y el del navegador no coincidirían.
 */
export function CityPicker() {
  const [mounted, setMounted] = React.useState(false);
  const city = useLocationStore((s) => s.city);
  const setCity = useLocationStore((s) => s.setCity);

  React.useEffect(() => setMounted(true), []);

  const shown = mounted ? city : DEFAULT_CITY.name;
  const days = CITIES.find((c) => c.name === shown)?.days ?? DEFAULT_CITY.days;

  return (
    <DropdownMenu>
      {/* El disparador hereda el color de la barra que lo contiene en vez de
          fijar uno propio: así sigue legible si esa barra cambia de fondo. */}
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-current">
        <MapPin className="size-3.5 opacity-80" />
        <span>
          Enviar a <span className="font-semibold">{shown}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block">Elige tu ciudad</span>
            <span className="block text-xs font-normal text-muted-foreground">
              Entrega estimada en {days} día{days === 1 ? "" : "s"} hábil
              {days === 1 ? "" : "es"}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto">
          {CITIES.map((c) => (
            <DropdownMenuItem
              key={c.name}
              onClick={() => setCity(c.name, c.state)}
              className="justify-between"
            >
              <span className="min-w-0">
                <span className="block truncate">{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.state}
                </span>
              </span>
              <Check
                className={cn(
                  "size-4 shrink-0 text-primary",
                  shown !== c.name && "invisible",
                )}
              />
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
