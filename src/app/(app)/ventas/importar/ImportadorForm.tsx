"use client";
import { useActionState } from "react";
import { importarVentasAction, type ImportVentasState } from "./actions";

const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(v));

export function ImportadorForm() {
  const [state, action, pending] = useActionState<ImportVentasState, FormData>(importarVentasAction, {});
  const hayPreview = !!(state.preview && state.anios && state.anios.length > 0);

  return (
    <div className="card">
      <div className="chart-head">Importar ventas <span className="hact">SIESA · FACTURAS POR ITEM</span></div>
      <div className="card-body">
        <form action={action} className="toolbar" style={{ flexWrap: "wrap" }}>
          <input type="file" name="file" accept=".xlsx,.xls,.xlsm" required className="select" />
          <button type="submit" name="intent" value="preview" className="btn" disabled={pending}>
            {pending ? "Procesando…" : "🔍 Previsualizar"}
          </button>
          {hayPreview && (
            <button type="submit" name="intent" value="commit" className="btn primary" disabled={pending}>
              ✅ Confirmar y reliquidar
            </button>
          )}
        </form>

        {state.error && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "var(--bad-bg, #fdecec)", color: "var(--bad)", fontWeight: 600 }}>{state.error}</div>
        )}
        {state.committed && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "var(--ok-bg, #e9f6ee)", color: "var(--ok)", fontWeight: 600 }}>
            ✅ Reliquidado. Los años del archivo se actualizaron en Ventas.
          </div>
        )}

        {(state.preview || state.committed) && state.anios && (
          <div style={{ marginTop: 12 }}>
            <p className="flag" style={{ marginBottom: 8 }}>
              {fmt(state.renglones ?? 0)} renglones · {state.sinFecha ?? 0} sin fecha · Nota Crédito $ {fmt(state.totalNC ?? 0)}
              {state.preview ? " · (previsualización — nada escrito aún)" : ""}
            </p>
            <div className="tbl-wrap">
              <table className="tabla-fit">
                <thead><tr><th>Año</th><th className="r">Venta neta</th><th className="r">Líneas</th><th className="r">Clientes</th></tr></thead>
                <tbody>
                  {state.anios.map((a) => (
                    <tr key={a.anio}>
                      <td style={{ fontWeight: 600 }}>{a.anio}</td>
                      <td className="r num">$ {fmt(a.neto)}</td>
                      <td className="r num">{a.lineas}</td>
                      <td className="r num">{a.clientes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="flag" style={{ marginTop: 10, marginBottom: 0 }}>
          Sube el reporte SIESA <strong>FACTURAS POR ITEM</strong>. Se recalcula la Nota Crédito con los parámetros y exclusiones actuales y se <strong>reemplazan los años presentes</strong> en el archivo. Máx 30 MB — para el histórico completo (archivos grandes) usa la recarga por lote (<code>npm run db:ventas</code>).
        </p>
      </div>
    </div>
  );
}
