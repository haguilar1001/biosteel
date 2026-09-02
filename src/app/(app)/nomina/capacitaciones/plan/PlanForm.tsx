"use client";
// ==========================================================
// Editor del plan de formación: los doce meses del año, uno por casilla.
//
// Se edita el año COMPLETO de una vez y no mes por mes: el plan se aprueba
// así, y guardar doce veces para cuadrar un semestre es la forma segura de
// dejarlo a medias.
//
// Una casilla vacía NO es cero: significa "este mes todavía no tiene plan", y
// el indicador de ejecución lo muestra como tal en vez de inventar un 100 %.
// ==========================================================
import { useActionState } from "react";
import { guardarPlanAction, type PlanState } from "./actions";

export interface FilaPlanUI {
  mes: number;
  label: string;
  planeadas: number | null;
  ejecutadas: number;
}

export function PlanForm({ anio, filas, puedeEditar }: { anio: number; filas: FilaPlanUI[]; puedeEditar: boolean }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(guardarPlanAction, {});

  if (!puedeEditar) {
    return (
      <p className="flag" style={{ margin: 0 }}>
        Solo quien tenga el permiso <code>capacitaciones.manage</code> puede editar el plan de formación.
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="anio" value={anio} />

      {state.ok && <div className="alert ok" role="status">✅ {state.mensaje}</div>}
      {state.error && <div className="alert" role="alert" style={{ color: "var(--bad)" }}>⚠️ {state.error}</div>}

      <div className="tbl-wrap">
        <table data-noorden>
          <thead>
            <tr>
              <th>Mes</th>
              <th className="r">Planeadas</th>
              <th className="r">Ejecutadas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const sinPlan = f.planeadas == null;
              const cumple = !sinPlan && f.planeadas! > 0 ? (f.ejecutadas / f.planeadas!) * 100 > 70 : null;
              return (
                <tr key={f.mes}>
                  <td>{f.label}</td>
                  <td className="r">
                    <input
                      type="number" name={`mes-${f.mes}`} min={0} max={99}
                      defaultValue={f.planeadas ?? ""} placeholder="—"
                      className="select" style={{ maxWidth: 90, textAlign: "right" }}
                    />
                  </td>
                  <td className="r num">{f.ejecutadas}</td>
                  <td>
                    {sinPlan
                      ? <span className="flag">sin plan</span>
                      : f.planeadas === 0
                        ? <span className="flag">nada planeado</span>
                        : <span className={`tag ${cumple ? "t-ok" : "t-bad"}`}>
                            {((f.ejecutadas / f.planeadas!) * 100).toFixed(0)} %
                          </span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="flag" style={{ fontSize: 12, margin: "10px 0" }}>
        Deja la casilla <b>vacía</b> en los meses que todavía no tienen plan: no es lo mismo que poner
        cero. Un mes sin plan no entra al indicador de ejecución en vez de contarse como cumplido.
      </p>

      <div className="toolbar" style={{ justifyContent: "flex-end" }}>
        <a href="/nomina/capacitaciones" className="btn">Volver</a>
        <button className="btn primary" disabled={pending}>{pending ? "Guardando…" : "💾 Guardar plan"}</button>
      </div>
    </form>
  );
}
