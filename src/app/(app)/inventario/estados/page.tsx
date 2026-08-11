// ==========================================================
// Inventario · Informe por Estado
// Matriz Estado × Ciudad con KPIs por estado (equivale a la hoja
// "INFORME DE ESTADOS" del Excel, mejorada).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatNumero } from "@/lib/format";
import {
  inventarioPorEstado, composicionInventario, estadoLabel, estadoClase, estadoIcono, ESTADOS,
} from "@/lib/negocio/inventario";
import { DonutConteo, BarrasApiladas, ESTADO_COLOR, type Segmento, type FilaBarra } from "../_viz";

const KPI_CLASE: Record<string, string> = {
  activo: "k-ok", en_reparacion: "k-w", de_baja: "k-bad", pendiente: "k-ingreso",
};

export default async function InventarioEstadosPage() {
  await requirePermiso("inventario.view");
  const [inf, comp] = await Promise.all([inventarioPorEstado(), composicionInventario()]);

  const donutEstados: Segmento[] = ESTADOS.map((e) => ({ label: estadoLabel(e), valor: inf.porEstado[e], color: ESTADO_COLOR[e]! }));
  const leyenda: Segmento[] = ESTADOS.map((e) => ({ label: estadoLabel(e), valor: 0, color: ESTADO_COLOR[e]! }));
  const barrasCiudad: FilaBarra[] = comp.porCiudadEstado.map((c) => ({
    label: c.ciudad,
    total: c.total,
    partes: ESTADOS.map((e) => ({ label: estadoLabel(e), valor: c.estados[e], color: ESTADO_COLOR[e]! })),
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventarios</div>
          <h1>Informe por Estado</h1>
          <p>Distribución de ítems por estado y ciudad · {formatNumero(inf.total)} ítems registrados</p>
        </div>
      </div>

      <div className="kpis">
        {ESTADOS.map((e) => (
          <div key={e} className={`kpi ${KPI_CLASE[e]}`}>
            <div className="klabel">{estadoIcono(e)} {estadoLabel(e)}</div>
            <div className="kval num">{formatNumero(inf.porEstado[e])}</div>
            <div className="ksub">
              <span className="flag">
                {inf.total ? `${((inf.porEstado[e] / inf.total) * 100).toFixed(1)} % del total` : "—"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 12, alignItems: "start" }}>
        <div className="card">
          <div className="chart-head">Composición por estado</div>
          <DonutConteo data={donutEstados} centro={{ valor: formatNumero(inf.total), etiqueta: "ítems" }} />
        </div>
        <div className="card">
          <div className="chart-head">Ítems por ciudad · desglose por estado</div>
          <BarrasApiladas filas={barrasCiudad} leyenda={leyenda} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="chart-head">Detalle por estado y ciudad</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                {inf.ciudades.map((c) => <th key={c} className="r">{c}</th>)}
                <th className="r">Total</th>
              </tr>
            </thead>
            <tbody>
              {inf.filas.map((f) => (
                <tr key={f.estado}>
                  <td>
                    <span className={`tag ${estadoClase(f.estado)}`}>{estadoIcono(f.estado)} {estadoLabel(f.estado)}</span>
                  </td>
                  {inf.ciudades.map((c) => (
                    <td key={c} className="r num" style={f.porCiudad[c] ? undefined : { color: "var(--muted)" }}>
                      {f.porCiudad[c] ? formatNumero(f.porCiudad[c]) : "·"}
                    </td>
                  ))}
                  <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(f.total)}</td>
                </tr>
              ))}
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total por ciudad</td>
                {inf.ciudades.map((c) => (
                  <td key={c} className="r num" style={{ fontWeight: 800 }}>{formatNumero(inf.totalPorCiudad[c] ?? 0)}</td>
                ))}
                <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(inf.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
