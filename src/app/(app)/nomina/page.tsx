// ==========================================================
// Nómina · Resumen — costo de personal del año (solo BioSteel). KPIs (costo
// mensual/anual, empleados, salario promedio), anillo por tipo de contrato,
// composición del costo, ranking por proceso y por ciudad, y comparativo por
// proceso vs año anterior. Selector de año.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatCOPCorto, formatNumero } from "@/lib/format";
import { Monto } from "../_components/Monto";
import {
  aniosConNomina, resumenAnual, porProceso, porCiudad,
  composicionCosto, comparativoProceso,
} from "@/lib/negocio/nomina";
import { Donut } from "../_components/charts/Donut";
import { TopRanking } from "../_components/charts/TopRanking";
import { BarrasComparativas } from "../_components/charts/BarrasComparativas";
import { FiltroAuto } from "../_components/FiltroAuto";


export default async function NominaPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  const anios = await aniosConNomina();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin nómina cargada. Corre <code>npm run db:nomina</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const anioAnt = anio - 1;
  const hayAnterior = anios.includes(anioAnt);

  const [kpi, procesos, ciudades, comp, compProceso] = await Promise.all([
    resumenAnual(anio),
    porProceso(anio),
    porCiudad(anio),
    composicionCosto(anio),
    hayAnterior ? comparativoProceso(anio, anioAnt) : Promise.resolve([]),
  ]);

  // Composición del costo (mensual): salario base + auxilio + aportes + provisiones.
  const donutComp = [
    { label: "Salario base", valor: comp.baseSalarial },
    { label: "Auxilio transporte", valor: comp.auxTransporte },
    { label: "Seguridad social (patronal)", valor: comp.seguridadSocial },
    { label: "Prestaciones sociales", valor: comp.prestaciones },
  ].filter((s) => s.valor > 0);

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>Costo de Personal · {anio}</div>
          <FiltroAuto className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </FiltroAuto>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi kc k-egreso"><div className="klabel">Costo mensual</div><div className="kval num"><Monto value={kpi.costoMensual} /></div></div>
        <div className="kpi kc k-egreso"><div className="klabel">Costo anual (×12)</div><div className="kval num"><Monto value={kpi.costoAnual} /></div></div>
        <div className="kpi kc"><div className="klabel">Empleados</div><div className="kval num">{formatNumero(kpi.headcount)}</div></div>
        <div className="kpi kc k-w"><div className="klabel">Salario base prom.</div><div className="kval num"><Monto value={kpi.salarioPromedio} /></div></div>
      </div>

      {/* Composición + rankings por proceso y ciudad, en una sola fila. */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", marginBottom: 12, alignItems: "start" }}>
        {/* Composición del costo */}
        <div className="card">
          <div className="chart-head">Composición del Costo <span className="hact">mensual · {anio}</span></div>
          <div className="card-body" style={{ display: "grid", placeItems: "center" }}>
            {donutComp.length === 0 ? <div className="empty">Sin datos.</div> : (
              <Donut azul data={donutComp} size={220} centro={{ valor: formatCOP(kpi.costoMensual), valorCorto: formatCOPCorto(kpi.costoMensual), etiqueta: "costo/mes" }} />
            )}
          </div>
        </div>

        {/* Ranking por proceso */}
        <TopRanking
          titulo={`Costo por Proceso · ${anio}`}
          items={procesos.map((p) => ({ label: p.label, valor: p.costoMensual, sub: `${p.headcount} empl.` }))}
          inicial={8}
        />
        {/* Ranking por ciudad */}
        <TopRanking
          titulo={`Costo por Ciudad · ${anio}`}
          items={ciudades.map((c) => ({ label: c.label, valor: c.costoMensual, sub: `${c.headcount} empl.` }))}
          color="var(--w1)"
          inicial={8}
        />
      </div>

      {/* Comparativo por proceso vs año anterior */}
      {hayAnterior && compProceso.length > 0 && (
        <BarrasComparativas
          titulo="Costo mensual por Proceso · comparativo"
          items={compProceso}
          labelA={`${anio}`}
          labelB={`${anioAnt}`}
          inicial={10}
        />
      )}
    </>
  );
}
