// ==========================================================
// Ventas x Mes — informe anual. KPIs (Venta Neta, Costo, Utilidad, %),
// tabla Mes vs Año Anterior con variación, venta por cliente (anillo) y
// venta por mes (barras). Selector de año.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { resumenAnual, ventaMensualDetalle, ventaPorCliente, aniosConVenta } from "@/lib/negocio/ventas";
import { Donut } from "../_components/charts/Donut";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CAT = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];
const mill = (v: number) => `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(v / 1e6))} mill.`;

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  const anios = await aniosConVenta();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin ventas cargadas. Corre <code>npm run db:ventas</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;

  const [kpi, mesesAct, mesesAnt, clientes] = await Promise.all([
    resumenAnual(anio),
    ventaMensualDetalle(anio),
    ventaMensualDetalle(anio - 1),
    ventaPorCliente(anio),
  ]);

  const totalAnt = mesesAnt.reduce((s, m) => s + m.venta, 0);
  const maxVenta = Math.max(1, ...mesesAct.map((m) => m.venta));

  // Anillo por cliente: top 7 + "Otras".
  const top = clientes.slice(0, 7);
  const resto = clientes.slice(7).reduce((s, c) => s + c.valor, 0);
  const donut = [
    ...top.map((c, i) => ({ label: c.clienteNombre, valor: c.valor, color: CAT[i % CAT.length]! })),
    ...(resto > 0 ? [{ label: "Otras", valor: resto, color: "var(--muted)" }] : []),
  ];

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>Informe de Ventas · {anio}</div>
          <form method="get" className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button type="submit" className="btn primary">Ver</button>
          </form>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi"><div className="klabel">Venta Neta</div><div className="kval num">{mill(kpi.venta)}</div><div className="ksub"><span className="flag">{formatCOP(kpi.venta)}</span></div></div>
        <div className="kpi k-egreso"><div className="klabel">Costo</div><div className="kval num">{mill(kpi.costo)}</div><div className="ksub"><span className="flag">{formatCOP(kpi.costo)}</span></div></div>
        <div className="kpi k-ok"><div className="klabel">Utilidad</div><div className="kval num">{mill(kpi.utilidad)}</div><div className="ksub"><span className="flag">{formatCOP(kpi.utilidad)}</span></div></div>
        <div className="kpi k-w"><div className="klabel">% Utilidad</div><div className="kval num">{formatPorcentaje(kpi.margen)}</div></div>
      </div>

      <div className="grid two" style={{ marginBottom: 12, alignItems: "start" }}>
        {/* Tabla Mes vs Año Anterior */}
        <div className="card">
          <div className="chart-head">Ventas · Mes vs Año Anterior <span className="hact">{anio} vs {anio - 1}</span></div>
          <div className="tbl-wrap">
            <table className="tabla-fit">
              <thead><tr><th>Mes</th><th className="r">Venta {anio}</th><th className="r">Venta {anio - 1}</th><th className="r">Dif. $</th><th className="r">% Var.</th></tr></thead>
              <tbody>
                {mesesAct.map((m) => {
                  const ant = mesesAnt[m.mes - 1]!.venta;
                  const dif = m.venta - ant;
                  const varr = ant > 0 ? (dif / ant) * 100 : null;
                  const vac = m.venta === 0 && ant === 0;
                  if (vac) return null;
                  const colDif = dif >= 0 ? "var(--ok)" : "var(--bad)";
                  return (
                    <tr key={m.mes}>
                      <td style={{ fontWeight: 600 }}>{MESES[m.mes]}</td>
                      <td className="r num">{m.venta ? formatCOP(m.venta) : "—"}</td>
                      <td className="r num flag">{ant ? formatCOP(ant) : "—"}</td>
                      <td className="r num" style={{ fontWeight: 600, color: colDif }}>{`${dif >= 0 ? "+" : "−"}${formatCOP(Math.abs(dif))}`}</td>
                      <td className="r num" style={{ fontWeight: 700, color: varr == null ? "var(--muted)" : varr >= 0 ? "var(--ok)" : "var(--bad)" }}>
                        {varr == null ? "—" : `${varr >= 0 ? "+" : ""}${formatPorcentaje(varr)}`}
                      </td>
                    </tr>
                  );
                })}
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(kpi.venta)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totalAnt)}</td>
                  <td className="r num" style={{ fontWeight: 800, color: kpi.venta - totalAnt >= 0 ? "var(--ok)" : "var(--bad)" }}>
                    {`${kpi.venta - totalAnt >= 0 ? "+" : "−"}${formatCOP(Math.abs(kpi.venta - totalAnt))}`}
                  </td>
                  <td className="r num" style={{ fontWeight: 800, color: totalAnt > 0 && kpi.venta >= totalAnt ? "var(--ok)" : "var(--bad)" }}>
                    {totalAnt > 0 ? `${kpi.venta >= totalAnt ? "+" : ""}${formatPorcentaje(((kpi.venta - totalAnt) / totalAnt) * 100)}` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Venta por cliente (anillo) */}
        <div className="card">
          <div className="chart-head">Venta por Cliente <span className="hact">{anio}</span></div>
          <div className="card-body" style={{ display: "grid", placeItems: "center" }}>
            {donut.length === 0 ? <div className="empty">Sin datos.</div> : (
              <Donut data={donut} size={260} centro={{ valor: mill(kpi.venta), etiqueta: "venta neta" }} />
            )}
          </div>
        </div>
      </div>

      {/* Venta por mes (barras) */}
      <div className="card">
        <div className="chart-head">Venta neta por mes <span className="hact">{anio}</span></div>
        <div className="card-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mesesAct.filter((m) => m.venta > 0).map((m) => (
              <div key={m.mes} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="flag" style={{ width: 78, flex: "0 0 auto" }}>{MESES[m.mes]}</span>
                <div className="rank-bar" style={{ flex: 1, height: 14 }}>
                  <div style={{ width: `${Math.max(2, (m.venta / maxVenta) * 100)}%`, height: "100%", background: "var(--brand)" }} />
                </div>
                <span className="num" style={{ width: 128, textAlign: "right", fontWeight: 700, fontSize: 12.5 }}>{formatCOP(m.venta)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
