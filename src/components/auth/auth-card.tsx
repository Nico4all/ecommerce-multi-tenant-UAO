import * as React from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Piezas compartidas de las pantallas de acceso (entrar, registrarse,
 * recuperar y restablecer).
 *
 * Las cuatro pantallas repetían la misma caja y el mismo bloque de error con
 * ligeras diferencias de sombra y espaciado. Al unificarlas, el encabezado
 * lleva el mismo remate rojo que encabeza el resto de la tienda: el manual
 * pide que el rojo esté siempre presente, y aquí es lo único rojo del bloque.
 */

/** Caja blanca sobre el lienzo crema. `footer` es el texto de debajo. */
export function AuthCard({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
      {footer && (
        <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>
      )}
    </div>
  );
}

/**
 * Título de la pantalla. La descripción se sangra para quedar alineada con el
 * título, no con el remate.
 */
export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h1 className="flex items-center gap-3 font-heading text-2xl font-bold tracking-tight">
        <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-brand" />
        {title}
      </h1>
      {description && (
        <p className="mt-2 pl-4 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/**
 * Estado con icono: el correo enviado, la contraseña cambiada, el enlace
 * incompleto. `role="status"` hace que el lector de pantalla lo anuncie al
 * sustituir al formulario, que si no cambia sin avisar a nadie.
 */
export function AuthNotice({
  icon: Icon,
  title,
  tone = "info",
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone?: "info" | "error";
  /** Botón o enlace que continúa el camino, si lo hay. */
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div role="status" className="text-center">
      <span
        className={cn(
          "mx-auto grid size-12 place-items-center rounded-full",
          tone === "error"
            ? "bg-destructive/10 text-destructive"
            : "bg-brand-soft text-primary",
        )}
      >
        <Icon aria-hidden className="size-6" />
      </span>
      <h1 className="mt-4 font-heading text-xl font-bold">{title}</h1>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Error de envío del formulario. */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-sm text-destructive"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}
