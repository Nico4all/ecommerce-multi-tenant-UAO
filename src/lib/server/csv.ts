import "server-only";

/**
 * Utilidades para exportar CSV desde los route handlers del panel.
 *
 * Lleva BOM (Excel abre bien los acentos) y separa filas con CRLF. Cada celda
 * se escapa: entre comillas si trae coma, comillas o saltos de línea.
 */

function cell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BOM = String.fromCharCode(0xfeff);

/** Construye una respuesta CSV descargable (attachment) con el nombre dado. */
export function csvResponse(
  filename: string,
  header: string[],
  rows: (string | number)[][],
): Response {
  const csv = [header, ...rows]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  return new Response(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Fecha de hoy YYYY-MM-DD para el nombre del archivo. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
