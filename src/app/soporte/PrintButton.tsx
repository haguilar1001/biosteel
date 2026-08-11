"use client";
// Barra de acciones del soporte (no se imprime): volver + Guardar PDF.
import { useEffect } from "react";

export default function PrintButton({ auto = false, volverHref = "/inventario/novedades" }: { auto?: boolean; volverHref?: string }) {
  // Si se abre con ?auto=1, dispara el diálogo de impresión al cargar.
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [auto]);

  return (
    <div className="sop-toolbar no-print">
      <a className="sop-back" href={volverHref}>← Volver a Novedades</a>
      <div className="sop-actions">
        <button className="sop-btn ghost" onClick={() => window.close()}>Cerrar</button>
        <button className="sop-btn" onClick={() => window.print()}>🖨️ Imprimir / Guardar PDF</button>
      </div>
    </div>
  );
}
