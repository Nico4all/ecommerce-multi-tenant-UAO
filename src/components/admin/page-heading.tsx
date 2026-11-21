/**
 * Encabezado de una pantalla del panel.
 *
 * Lleva el mismo remate rojo que encabeza todas las pantallas de la tienda:
 * es lo que hace que el panel se lea como parte de la misma casa y no como
 * otra aplicación pegada al lado.
 */
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 font-heading text-xl font-bold tracking-tight sm:text-2xl">
          <span
            aria-hidden
            className="h-6 w-1 shrink-0 rounded-full bg-brand sm:h-7"
          />
          {title}
        </h1>
        {description && (
          <p className="mt-1 pl-4 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}
