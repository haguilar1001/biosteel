// ==========================================================
// Ventas x Mes — informe anual. KPIs (Venta Neta, Costo, Utilidad, %),
// tabla Mes vs Año Anterior con variación, venta por cliente (anillo) y
// venta por mes (barras). Selector de año.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { resumenAnual, ventaMensualDetalle, ventaPorCiudad, aniosConVenta } from "@/lib/negocio/ventas";
import { Donut } from "../_components/charts/Donut";
import { LineasMensuales } from "../_components/charts/LineasMensuales";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MES_ABBR = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mill = (v: number) => `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(v / 1e6))} MM`;

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  const anios = await aniosConVenta();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin ventas cargadas. Corre <code>npm run db:ventas</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;

  const [kpi, mesesAct, mesesAnt, ciudades] = await Promise.all([
    resumenAnual(anio),
    ventaMensualDetalle(anio),
    ventaMensualDetalle(anio - 1),
    ventaPorCiudad(anio),
  ]);

  const totalAnt = mesesAnt.reduce((s, m) => s + m.venta, 0);

  // Meses transcurridos: no comparar contra el año anterior los meses que aún
  // no han pasado (evita difs y % engañosos, p. ej. −100 %).
  const hoy = new Date();
  const mesActual = anio < hoy.getUTCFullYear() ? 12 : anio > hoy.getUTCFullYear() ? 0 : hoy.getUTCMonth() + 1;
  const esFuturo = (mes: number) => mes > mesActual;
  const parcial = mesActual >= 1 && mesActual < 12; // año en curso

  // Total comparable: solo meses transcurridos de ambos años.
  let v26c = 0, v25c = 0;
  for (const m of mesesAct) {
    if (esFuturo(m.mes)) continue;
    v26c += m.venta;
    v25c += mesesAnt[m.mes - 1]!.venta;
  }
  const difC = v26c - v25c;
  const varC = v25c > 0 ? (difC / v25c) * 100 : null;

  // Promedio por mes transcurrido (mismos meses en ambos años).
  const nMeses = Math.max(1, mesActual);
  const prom26 = v26c / nMeses;
  const prom25 = v25c / nMeses;
  const difProm = prom26 - prom25;

  // Anillo por ciudad (modo azul: agrupa los menores en "Otros menores").
  // detalle = IPS de la ciudad (para el tooltip).
  const donut = ciudades.map((c) => ({
    label: c.ciudad,
    valor: c.valor,
    detalle: c.ips.map((i) => ({ label: i.nombre, valor: i.valor })),
  }));

  // Series para la gráfica de líneas (año en curso corta en el mes actual).
  const serieActual = mesesAct.map((m) => (esFuturo(m.mes) ? null : m.venta));
  const serieAnterior = mesesAnt.map((m) => m.venta);

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
            <a href={`/ventas/export?anio=${anio}`} className="btn" title="Descargar ventas por mes en Excel">⬇️ Excel</a>
          </form>
        </div>
      </div>

      {/* KPIs — centrados */}
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi kc"><div className="klabel">Venta Neta</div><div className="kval num">{mill(kpi.venta)}</div><div className="ksub"><span className="flag">{formatCOP(kpi.venta)}</span></div></div>
        <div className="kpi kc k-egreso"><div className="klabel">Costo</div><div className="kval num">{mill(kpi.costo)}</div><div className="ksub"><span className="flag">{formatCOP(kpi.costo)}</span></div></div>
        <div className="kpi kc k-ok"><div className="klabel">Utilidad</div><div className="kval num">{mill(kpi.utilidad)}</div><div className="ksub"><span className="flag">{formatCOP(kpi.utilidad)}</span></div></div>
        <div className="kpi kc k-w"><div className="klabel">% Utilidad</div><div className="kval num">{formatPorcentaje(kpi.margen)}</div></div>
      </div>

      <div className="grid two" style={{ marginBottom: 12, alignItems: "stretch" }}>
        {/* Tabla Mes vs Año Anterior */}
        <div className="card">
          <div className="chart-head">Ventas · Mes vs Año Anterior <span className="hact">{anio} vs {anio - 1}</span></div>
          <div className="tbl-wrap">
            <table className="tabla-fit">
              <thead><tr><th>Mes</th><th className="r">Venta {anio}</th><th className="r">Venta {anio - 1}</th><th className="r">Dif. $</th><th className="r">% Var.</th></tr></thead>
              <tbody>
                {mesesAct.map((m) => {
                  const ant = mesesAnt[m.mes - 1]!.venta;
                  const futuro = esFuturo(m.mes);
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
                      <td className="r num" style={{ fontWeight: 600, color: futuro ? "var(--muted)" : colDif }}>
                        {futuro ? "—" : `${dif >= 0 ? "+" : "−"}${formatCOP(Math.abs(dif))}`}
                      </td>
                      <td className="r num" style={{ fontWeight: 700, color: futuro || varr == null ? "var(--muted)" : varr >= 0 ? "var(--ok)" : "var(--bad)" }}>
                        {futuro || varr == null ? "—" : `${varr >= 0 ? "+" : ""}${formatPorcentaje(varr)}`}
                      </td>
                    </tr>
                  );
                })}
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(kpi.venta)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totalAnt)}</td>
                  <td className="r num" style={{ fontWeight: 800, color: difC >= 0 ? "var(--ok)" : "var(--bad)" }}>
                    {`${difC >= 0 ? "+" : "−"}${formatCOP(Math.abs(difC))}`}
                  </td>
                  <td className="r num" style={{ fontWeight: 800, color: varC == null ? "var(--muted)" : varC >= 0 ? "var(--ok)" : "var(--bad)" }}>
                    {varC == null ? "—" : `${varC >= 0 ? "+" : ""}${formatPorcentaje(varC)}`}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, fontStyle: "italic", color: "var(--muted)" }}>Promedio mes ({nMeses})</td>
                  <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(prom26)}</td>
                  <td className="r num flag">{formatCOP(prom25)}</td>
                  <td className="r num" style={{ fontWeight: 700, color: difProm >= 0 ? "var(--ok)" : "var(--bad)" }}>
                    {`${difProm >= 0 ? "+" : "−"}${formatCOP(Math.abs(difProm))}`}
                  </td>
                  <td className="r num" style={{ fontWeight: 700, color: varC == null ? "var(--muted)" : varC >= 0 ? "var(--ok)" : "var(--bad)" }}>
                    {varC == null ? "—" : `${varC >= 0 ? "+" : ""}${formatPorcentaje(varC)}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {parcial && (
            <p className="flag" style={{ padding: "8px 14px", margin: 0 }}>
              Dif. $ y % Var. comparan solo meses transcurridos (Ene–{MES_ABBR[mesActual]}).
            </p>
          )}
        </div>

        {/* Venta por ciudad (anillo) */}
        <div className="card">
          <div className="chart-head">Venta por Ciudad <span className="hact">{anio}</span></div>
          <div className="card-body" style={{ display: "grid", placeItems: "center" }}>
            {donut.length === 0 ? <div className="empty">Sin datos.</div> : (
              <Donut azul data={donut} size={260} centro={{ valor: mill(kpi.venta), etiqueta: "venta neta" }} />
            )}
          </div>
        </div>
      </div>

      {/* Venta neta por mes — líneas: año en curso vs anterior */}
      <div className="card">
        <div className="chart-head">Venta neta por mes <span className="hact">{anio} vs {anio - 1}</span></div>
        <div className="card-body">
          <LineasMensuales
            categorias={MES_ABBR.slice(1)}
            series={[
              { label: `${anio}`, color: "var(--brand)", data: serieActual },
              { label: `${anio - 1}`, color: "var(--w1)", data: serieAnterior, dash: true },
            ]}
          />
        </div>
      </div>
    </>
  );
}
