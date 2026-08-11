"use client";
// Botón para imprimir / guardar como PDF el listado (usa la hoja @media print).
export function BotonImprimir({ label = "🖨️ PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn no-print" onClick={() => window.print()} title="Imprimir o guardar como PDF">
      {label}
    </button>
  );
}
