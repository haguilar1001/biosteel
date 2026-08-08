// ==========================================================
// Compras por Proveedor × Mes (anual). Matriz proveedor × mes de los
// documentos de CxP emitidos en el año. Excluye internos.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatNumero } from "@/lib/format";
import { comprasPorProveedorMes } from "@/lib/negocio/cxp";
import { aniosConVenta } from "@/lib/negocio/ventas";

const MES_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mill = (v: number) => (v === 0 ? "—" : `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(v / 1e6))}`);

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  // Años disponibles: los de ventas ∪ el año en curso (compras pueden existir sin ventas cargadas).
  const aniosV = await aniosConVenta();
  const anioActual = new Date().getUTCFullYear();
  const anios = [...new Set([...aniosV, anioActual])].sort((a, b) => a - b);
  const anio = sp.anio && /^\d{4}$/.test(sp.anio) ? Number(sp.anio) : (aniosV[aniosV.length - 1] ?? anioActual);

  const { filas, totalMes, total } = await comprasPorProveedorMes(anio);

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>Compras por Proveedor × Mes · {anio} · {formatNumero(filas.length)} proveedores</div>
          <form method="get" className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">{anios.map((a) => <option key={a} value={a}>{a}</option>)}</select>
            <button type="submit" className="btn primary">Ver</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">Compras (facturado CxP) · valores en millones COP <span className="hact">total {formatCOP(total)}</span></div>
        <div className="tbl-wrap">
          <table className="tabla-fit" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>Proveedor</th>
                {MES_ABBR.map((m) => <th key={m} className="r">{m}</th>)}
                <th className="r" style={{ background: "var(--brand-tint)" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total · {formatNumero(filas.length)} prov.</td>
                {totalMes.map((v, i) => <td key={i} className="r num" style={{ fontWeight: 800 }}>{mill(v)}</td>)}
                <td className="r num" style={{ fontWeight: 800, background: "var(--brand-tint)" }}>{mill(total)}</td>
              </tr>
              {filas.length === 0 ? (
                <tr><td colSpan={14} className="empty">Sin compras (documentos de CxP) emitidas en {anio}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.proveedor}>
                    <td style={{ fontWeight: 600 }} title={f.proveedor}>{f.proveedor}</td>
                    {f.meses.map((v, i) => <td key={i} className="r num" style={{ color: v === 0 ? "var(--muted)" : undefined }} title={v ? formatCOP(v) : ""}>{mill(v)}</td>)}
                    <td className="r num" style={{ fontWeight: 700, background: "var(--brand-tint)" }}>{mill(f.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
