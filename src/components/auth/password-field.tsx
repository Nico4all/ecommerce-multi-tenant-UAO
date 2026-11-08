"use client";

import * as React from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Campo de contraseña con candado y alternador de visibilidad.
 *
 * Existía duplicado en entrar y registrarse, y las dos copias tenían el mismo
 * par de defectos: el alternador no mostraba el foco del teclado y su área
 * pulsable era el icono de 16px, por debajo de los 24x24 que pide WCAG 2.5.8.
 * Aquí el botón mide 36px y dibuja su anillo de foco.
 *
 * Acepta las mismas props que un `input`, así sirve tanto con `value`/
 * `onChange` como con el `register()` de react-hook-form.
 */
export function PasswordField({
  className,
  withLock = true,
  ...props
}: React.ComponentProps<"input"> & {
  /** El candado delante. Se apaga donde hay varios campos seguidos. */
  withLock?: boolean;
}) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="relative">
      {withLock && (
        <Lock
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <Input
        className={cn("h-11 pr-12", withLock ? "pl-9" : undefined, className)}
        {...props}
        type={show ? "text" : "password"}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
