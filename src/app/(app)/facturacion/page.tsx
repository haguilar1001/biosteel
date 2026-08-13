// ==========================================================
// PENDIENTES — pedidos por facturar (foto del día desde S1ESA).
// Equivalente al tablero "REPORTE DIARIO": KPIs (total por facturar, pedidos,
// días corridos), pendientes por IPS (expandible), por motivo y acumulado×mes.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatNumero, formatPorcentaje } from "@/lib/format";
import { Monto } from "../_components/Monto";
import {
  listarPendientes, resumenPendientes, pendientesPorIps, pendientesPorMotivo, pendientesPorMes,
} from "@/lib/negocio/pendientes";
import { PendientesIpsTabla } from "./PendientesIpsTabla";

const MES_ABBR = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const AZULES = ["var(--az-1)", "var(--az-2)", "var(--az-3)", "var(--az-4)", "var(--az-5)", "var(--az-6)", "var(--az-7)", "var(--az-8)", "var(--az-otros)"];
const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function PendientesPage() {
  await requirePermiso("cxp.view");
  const rows = await listarPendientes();

  if (rows.length === 0) {
    return (
      <div className="card"><div className="card-body">
        <div className="empty">Sin pedidos pendientes cargados. Sube el archivo por el formulario de carga (<code>/cargar</code>) o corre <code>npm run db:pendientes</code>.</div>
      </div></div>
    );
  }

  const resumen = resumenPendientes(rows);
  const porIps = pendientesPorIps(rows);
  const porMotivo = pendientesPorMotivo(rows);
  const matriz = pendientesPorMes(rows);
  const maxMotivo = Math.max(1, ...porMotivo.map((m) => m.pedidos));
  const ck = (a: number, m: number) => `${a}-${m}`;

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Pendientes por facturar · foto del día · {formatNumero(resumen.pedidos)} pedidos · {resumen.ips} IPS</div>

      {/* KPIs */}
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi kc"><div className="klabel">Total por facturar</div><div className="kval num"><Monto value={resumen.total} /></div></div>
        <div className="kpi kc"><div className="klabel"># Pedidos</div><div className="kval num">{nf.format(resumen.pedidos)}</div><div className="ksub"><span className="flag">{resumen.ips} IPS</span></div></div>
        <div className="kpi kc k-w"><div className="klabel">Días corridos prom.</div><div className="kval num">{resumen.diasProm}</div><div className="ksub"><span className="flag">días</span></div></div>
        <div className="kpi kc k-egreso"><div className="klabel">Antigüedad máx.</div><div className="kval num">{resumen.diasMax}</div><div className="ksub"><span className="flag">días</span></div></div>
      </div>

      <div className="grid two" style={{ marginBottom: 12, alignItems: "start" }}>
        {/* Pendientes por IPS (expandible) */}
        <div className="card">
          <div className="chart-head">Gastos pendientes por facturar <span className="hact">por IPS · clic para ver pedidos</span></div>
          <PendientesIpsTabla items={porIps} total={resumen.total} />
        </div>

        {/* Por motivo del pendiente */}
        <div className="card">
          <div className="chart-head">Descripción del pendiente <span className="hact">por motivo</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {porMotivo.map((m, idx) => {
              const pctP = (m.pedidos / resumen.pedidos) * 100;
              return (
                <div key={m.motivo} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, alignItems: "baseline" }}>
                  <span className="rank-label" title={m.motivo.toUpperCase()} style={{ fontSize: 12.5, fontWeight: 600 }}>{m.motivo.toUpperCase()}</span>
                  <span className="num" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {nf.format(m.pedidos)} <span className="flag">· {pctP.toFixed(1).replace(".", ",")}%</span> · <Monto value={m.valor} />
                  </span>
                  <div className="rank-bar" style={{ gridColumn: "1 / -1" }}><div style={{ width: `${Math.max(2, (m.pedidos / maxMotivo) * 100)}%`, background: AZULES[idx % AZULES.length] }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Acumulado por mes (IPS × mes, conteo de pedidos) */}
      <div className="card">
        <div className="chart-head">Pendientes acumulado × mes <span className="hact">conteo de pedidos por mes de creación</span></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>IPS</th>
                {matriz.meses.map((m) => <th key={ck(m.anio, m.mes)} className="r">{MES_ABBR[m.mes]} {String(m.anio).slice(2)}</th>)}
                <th className="r">Total</th>
                <th className="r">%</th>
              </tr>
            </thead>
            <tbody>
              {matriz.filas.map((f) => (
                <tr key={f.ips}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{f.ips}</td>
                  {matriz.meses.map((m) => {
                    const v = f.porMes.get(ck(m.anio, m.mes)) ?? 0;
                    return <td key={ck(m.anio, m.mes)} className="r num">{v ? nf.format(v) : "—"}</td>;
                  })}
                  <td className="r num" style={{ fontWeight: 700 }}>{nf.format(f.total)}</td>
                  <td className="r num flag">{matriz.totalGeneral ? formatPorcentaje((f.total / matriz.totalGeneral) * 100) : "—"}</td>
                </tr>
              ))}
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total</td>
                {matriz.meses.map((m) => <td key={ck(m.anio, m.mes)} className="r num" style={{ fontWeight: 800 }}>{nf.format(matriz.totalPorMes.get(ck(m.anio, m.mes)) ?? 0)}</td>)}
                <td className="r num" style={{ fontWeight: 800 }}>{nf.format(matriz.totalGeneral)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700, fontStyle: "italic", color: "var(--muted)" }}>%</td>
                {matriz.meses.map((m) => {
                  const c = matriz.totalPorMes.get(ck(m.anio, m.mes)) ?? 0;
                  return <td key={ck(m.anio, m.mes)} className="r num flag">{matriz.totalGeneral ? formatPorcentaje((c / matriz.totalGeneral) * 100) : "—"}</td>;
                })}
                <td className="r num flag">{formatPorcentaje(100)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
