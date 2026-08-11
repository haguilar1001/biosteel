// ==========================================================
// Helper para exportar un listado a Excel (.xlsx) como descarga.
// Lo usan las rutas /flujo/export, /cartera/export y /cxp/export.
// ==========================================================
import "server-only";
import * as XLSX from "xlsx";

export function libroDescarga(opts: {
  hoja: string;
  encabezado: string[];
  filas: (string | number)[][];
  archivo: string;
  anchos?: number[];
}): Response {
  const ws = XLSX.utils.aoa_to_sheet([opts.encabezado, ...opts.filas]);
  if (opts.anchos) ws["!cols"] = opts.anchos.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.hoja);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${opts.archivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
