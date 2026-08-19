// ==========================================================
// Asistencia Técnica · PQRS — registro mensual de quejas, reclamos y
// sugerencias. Es un dato que se digita: no sale de las evaluaciones de los
// asesores, por eso vive en su propia tabla (PqrsMes).
//
// Una fila por mes del año, cada una con su propio formulario, para que
// guardar un mes no obligue a tocar los demás.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { requireUsuario } from "@/server/auth-context";
import { formatNumero } from "@/lib/format";
import { FiltroAuto } from "../../_components/FiltroAuto";
import { prisma } from "@/lib/db";
import { pqrs, MES_LARGO } from "@/lib/negocio/asistencia-tecnica";
import { guardarPqrs } from "./actions";

const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default async function PqrsPage({
  searchParams,
}: { searchParams: Promise<{ anio?: string }> }) {
  await requirePermiso("cxp.view");
  const usuario = await requireUsuario();
  const puedeEditar = await puede(usuario, "asistencia.manage");
  const sp = await searchParams;

  // Años ofrecidos: los que ya tienen algo (evaluaciones o PQRS) más el actual.
  const [aniosEval, aniosPqrs] = await Promise.all([
    prisma.evaluacionAsesor.groupBy({ by: ["anio"] }),
    prisma.pqrsMes.groupBy({ by: ["anio"] }),
  ]);
  const anios = [...new Set([
    ...aniosEval.map((a) => a.anio),
    ...aniosPqrs.map((a) => a.anio),
    new Date().getFullYear(),
  ])].sort((a, b) => a - b);

  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const registros = await pqrs(anio);
  const porMes = new Map(registros.map((r) => [r.mes, r]));
  const total = registros.reduce((a, r) => a + r.casos, 0);
  const registrados = registros.length;

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 15 }}>PQRS · {anio}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              Quejas, reclamos y sugerencias de los usuarios y equipos quirúrgicos.
              Se digita mes a mes; alimenta la tarjeta de <a href="/asistencia">Asistencia Técnica</a>.
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

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className={`kpi kc ${total ? "k-bad" : "k-ok"}`}>
          <div className="klabel">Casos en el año</div>
          <div className="kval num">{formatNumero(total)}</div>
        </div>
        <div className="kpi kc k-w">
          <div className="klabel">Meses registrados</div>
          <div className="kval num">{registrados} / 12</div>
          <div className="ksub" style={{ color: "var(--muted)" }}>
            {registrados === 12 ? "año completo" : "un mes sin registro no cuenta como cero"}
          </div>
        </div>
        <div className="kpi kc">
          <div className="klabel">Meses con casos</div>
          <div className="kval num">{registros.filter((r) => r.casos > 0).length}</div>
        </div>
        <div className="kpi kc">
          <div className="klabel">Promedio mensual</div>
          <div className="kval num">{registrados ? (total / registrados).toFixed(1).replace(".", ",") : "—"}</div>
          <div className="ksub" style={{ color: "var(--muted)" }}>sobre los meses registrados</div>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">
          Registro Mensual
          <span className="hact">{puedeEditar ? "escriba los casos y guarde cada mes" : "solo lectura"}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table data-noorden>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Mes</th>
                <th className="r" style={{ width: 110 }}>Casos</th>
                <th>Observación</th>
                <th style={{ width: 150 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((m) => {
                const r = porMes.get(m);
                return (
                  <tr key={m}>
                    <td style={{ fontWeight: 600 }}>{MES_LARGO[m]}</td>
                    {puedeEditar ? (
                      <>
                        <td colSpan={3} style={{ padding: 0 }}>
                          <form action={guardarPqrs} className="toolbar" style={{ padding: "6px 12px", flexWrap: "nowrap", alignItems: "center" }}>
                            <input type="hidden" name="anio" value={anio} />
                            <input type="hidden" name="mes" value={m} />
                            <input
                              type="number" name="casos" min={0} step={1}
                              defaultValue={r?.casos ?? 0}
                              className="select" style={{ width: 90, textAlign: "right" }}
                              aria-label={`Casos de ${MES_LARGO[m]}`}
                            />
                            <input
                              type="text" name="observacion"
                              defaultValue={r?.observacion ?? ""}
                              placeholder="Observación (opcional)"
                              className="select" style={{ flex: 1, minWidth: 200, fontWeight: 400 }}
                              aria-label={`Observación de ${MES_LARGO[m]}`}
                            />
                            <button type="submit" className="btn primary">Guardar</button>
                            {r
                              ? <span className={`tag ${r.casos ? "t-bad" : "t-ok"}`}>{r.casos ? `${r.casos} caso(s)` : "en cero"}</span>
                              : <span className="tag t-w1">sin registrar</span>}
                          </form>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="r num">{r ? formatNumero(r.casos) : "—"}</td>
                        <td style={{ whiteSpace: "normal" }}>{r?.observacion || "—"}</td>
                        <td>{r
                          ? <span className={`tag ${r.casos ? "t-bad" : "t-ok"}`}>{r.casos ? `${r.casos} caso(s)` : "en cero"}</span>
                          : <span className="tag t-w1">sin registrar</span>}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card-body" style={{ fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--line)" }}>
          Un mes <b>sin registrar</b> no es lo mismo que un mes <b>en cero</b>: el primero significa que todavía
          nadie revisó el periodo. Guardar en cero deja constancia de que sí se revisó y no hubo casos.
          {!puedeEditar && <> Para registrar hace falta el permiso <code>asistencia.manage</code>.</>}
        </div>
      </div>
    </>
  );
}
