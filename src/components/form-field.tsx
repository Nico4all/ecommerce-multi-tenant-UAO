import type { FieldError } from "react-hook-form";
import { Label } from "@/components/ui/label";

/**
 * Campo de formulario: etiqueta + control + mensaje de error o pista.
 * Compartido por los formularios de cuenta, recuperación y alta de usuarios
 * (mismo patrón que los formularios de PQR/contacto).
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error.message}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
