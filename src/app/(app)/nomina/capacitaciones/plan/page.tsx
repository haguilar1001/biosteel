// ==========================================================
// Nómina · Capacitaciones · Plan de formación.
//
// Las capacitaciones PLANEADAS no vienen en el consolidado —el Excel solo
// trae lo que ya se dictó—, así que se llevan aquí. Son el denominador del
// indicador de ejecución, y sin ellas ese indicador no se puede calcular.
// ==========================================================
import { requireUsuario, requirePermiso } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { aniosConCapacitaciones, planDelAnio, MES_LARGO, META_EJECUCION } from "@/lib/negocio/capacitaciones";
import { FiltroAuto } from "../../../_components/FiltroAuto";
import { PlanForm } from "./PlanForm";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requirePermiso("capacitaciones.view");
  const usuario = await requireUsuario();
  const puedeEditar = await puede(usuario, "capacitaciones.manage");
  const sp = await searchParams;

  // El plan se puede escribir por adelantado, así que la lista de años ofrece
  // también el año en curso y el siguiente aunque todavía no tengan registros.
  const conDatos = await aniosConCapacitaciones();
  const enCurso = new Date().getUTCFullYear();
  const anios = [...new Set([...conDatos, enCurso, enCurso + 1])].sort((a, b) => a - b);
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : (conDatos[conDatos.length - 1] ?? enCurso);

  const filas = await planDelAnio(anio);

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div className="eyebrow" style={{ fontSize: 15 }}>Plan de formación · {anio}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              Capacitaciones planeadas por mes · denominador del indicador de ejecución (meta &gt; {META_EJECUCION} %)
            </div>
          </div>
          <FiltroAuto className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </FiltroAuto>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">
          Capacitaciones planeadas
          <span className="hact">las ejecutadas salen del consolidado</span>
        </div>
        <div className="card-body">
          <PlanForm
            anio={anio}
            puedeEditar={puedeEditar}
            filas={filas.map((f) => ({ ...f, label: MES_LARGO[f.mes]! }))}
          />
        </div>
      </div>
    </>
  );
}
