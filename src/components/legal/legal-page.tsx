/**
 * Envoltorio compartido por las 4 páginas legales: título, fecha de
 * actualización, y estilos aplicados por selector a los elementos semánticos
 * del contenido (h2, p, li, a, strong) para no repetir className en cada uno.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** Fecha en formato legible, p.ej. "21 de julio de 2026". */
  updated: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Última actualización: {updated}
      </p>
      {intro && (
        <p className="mt-4 text-sm text-muted-foreground">{intro}</p>
      )}

      <div
        className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground
          [&_h2]:mb-2 [&_h2]:mt-0 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground
          [&_p]:mt-2 [&_p:first-child]:mt-0
          [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
          [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5
          [&_strong]:font-semibold [&_strong]:text-foreground
          [&_a]:font-medium [&_a]:text-primary [&_a]:hover:underline"
      >
        {children}
      </div>
    </div>
  );
}

/** Una sección con título h2, para dividir el documento en bloques. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
