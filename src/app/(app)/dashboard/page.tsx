// ==========================================================
// Dashboard — Panel de Flujo de Caja
// Combina flujo (ingresos/egresos/presupuesto), CxP y cartera,
// respetando permisos y alcance del usuario.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { puede, alcanceDe } from "@/lib/rbac/authorize";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { flujoMensual, totalesFlujo, presupuestoVsReal, MESES_LABEL } from "@/lib/negocio/flujo";
import { resumenCxp, cxpPorProveedor } from "@/lib/negocio/cxp";
import { resumenCartera } from "@/lib/negocio/cartera";

const ANIO = 2026;

export default async function DashboardPage() {
  const { usuario } = await requirePermiso("dashboard.view");
  const verCxp = await puede(usuario, "cxp.view");

  const [meses, tot, presup, cxp, topProv] = verCxp
    ? await Promise.all([
        flujoMensual(ANIO),
        totalesFlujo(ANIO),
        presupuestoVsReal(ANIO),
        resumenCxp(),
        cxpPorProveedor(),
      ])
    : [null, null, null, null, null];

  // Cartera según alcance (hoy vacía hasta cargar CxC).
  const alcanceCartera = await alcanceDe(usuario, "cartera.view");
  const cartera = alcanceCartera !== "ninguno" ? await resumenCartera(usuario, alcanceCartera) : null;

  const maxBar = meses ? Math.max(1, ...meses.map((m) => Math.max(m.ingresos, m.egresos))) : 1;
  const topPresup = presup ? [...presup].sort((a, b) => b.real - a.real).slice(0, 6) : [];
  const maxPresup = Math.max(1, ...topPresup.map((p) => Math.max(p.presupuesto, p.real)));
  const top8 = topProv ? topProv.slice(0, 8) : [];

  const hoy = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inicio</div>
          <h1>Panel de Flujo de Caja</h1>
          <p>Corte a {hoy} · {usuario.rol.nombre}</p>
        </div>
      </div>

      {tot && cxp ? (
        <>
          <div className="kpis">
            <div className="kpi k-ingreso">
              <div className="klabel">Ingresos {ANIO}</div>
              <div className="kval num">{formatCOP(tot.ingresos)}</div>
              <div className="ksub"><span className="flag">flujo neto {formatCOP(tot.neto)}</span></div>
            </div>
            <div className="kpi k-egreso">
              <div className="klabel">Egresos {ANIO}</div>
              <div className="kval num">{formatCOP(tot.egresos)}</div>
              <div className="ksub"><span className="flag">ejecución {formatPorcentaje(tot.ejecucion)}</span></div>
            </div>
            <div className="kpi">
              <div className="klabel">CxP neta</div>
              <div className="kval num">{formatCOP(cxp.total)}</div>
              <div className="ksub"><span className="flag">vencida {formatCOP(cxp.vencido)}</span></div>
            </div>
            <div className="kpi k-w">
              <div className="klabel">Anticipos (aparte)</div>
              <div className="kval num">{formatCOP(cxp.anticipos)}</div>
              <div className="ksub"><span className="flag">{cxp.anticiposCantidad} documentos</span></div>
            </div>
          </div>

          <div className="grid two" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="chart-head">Ingresos vs Egresos por mes <span className="hact">{ANIO}</span></div>
              <div className="card-body">
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 170 }}>
                  {meses!.map((m) => (
                    <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
                        <div title={`Ingresos ${formatCOP(m.ingresos)}`} style={{ width: "38%", height: `${Math.max(1, (m.ingresos / maxBar) * 100)}%`, background: "var(--ingreso)", borderRadius: "3px 3px 0 0" }} />
                        <div title={`Egresos ${formatCOP(m.egresos)}`} style={{ width: "38%", height: `${Math.max(1, (m.egresos / maxBar) * 100)}%`, background: "var(--egreso)", borderRadius: "3px 3px 0 0" }} />
                      </div>
                      <span className="flag">{MESES_LABEL[m.mes]}</span>
                    </div>
                  ))}
                </div>
                <div className="legend"><span><i style={{ background: "var(--ingreso)" }} />Ingresos</span><span><i style={{ background: "var(--egreso)" }} />Egresos</span></div>
              </div>
            </div>

            <div className="card">
              <div className="chart-head">Presupuesto vs Real <span className="hact">top grupos</span></div>
              <div className="card-body">
                {topPresup.length === 0 ? (
                  <div className="empty">Sin datos de presupuesto.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {topPresup.map((p) => (
                      <div key={p.categoria}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: "var(--muted)" }}>{p.categoria}</span>
                          <span style={{ fontWeight: 700 }}>{formatPorcentaje(p.ejecucion)}</span>
                        </div>
                        <div style={{ position: "relative", height: 10, borderRadius: 6, background: "var(--brand-tint)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, Math.round((p.presupuesto / maxPresup) * 100))}%`, height: "100%", background: "var(--brand-soft)" }} />
                          <div style={{ position: "absolute", top: 0, left: 0, width: `${Math.min(100, Math.round((p.real / maxPresup) * 100))}%`, height: "100%", background: p.ejecucion > 100 ? "var(--bad)" : "var(--brand-2)" }} />
                        </div>
                      </div>
                    ))}
                    <div className="legend"><span><i style={{ background: "var(--brand-soft)" }} />Presupuesto</span><span><i style={{ background: "var(--brand-2)" }} />Real</span></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="chart-head">Top proveedores por pagar <span className="hact">{top8.length} de {topProv!.length}</span></div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>Proveedor</th><th>Tipo</th><th className="r">Saldo neto</th><th className="r">Vencido</th><th className="r">Mora máx.</th></tr>
                </thead>
                <tbody>
                  {top8.length === 0 ? (
                    <tr><td colSpan={5} className="empty">Sin CxP.</td></tr>
                  ) : (
                    top8.map((p) => (
                      <tr key={p.proveedorId}>
                        <td style={{ fontWeight: 600 }}>{p.proveedor}</td>
                        <td><span className={`tag ${p.interno ? "t-w1" : "t-blue"}`}>{p.interno ? "Interno" : "Externo"}</span></td>
                        <td className="r num">{formatCOP(p.saldoNeto)}</td>
                        <td className="r num" style={{ color: p.vencido > 0 ? "var(--bad)" : "var(--muted)" }}>{formatCOP(p.vencido)}</td>
                        <td className="r num">{p.diasMax > 0 ? `${p.diasMax}d` : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card"><div className="card-body"><p style={{ margin: 0, color: "var(--muted)" }}>Tu rol no tiene acceso al flujo de caja ni a cuentas por pagar.</p></div></div>
      )}

      {/* Cartera (CxC) — pendiente de cargar */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="chart-head">Cartera (Cuentas por Cobrar)</div>
        <div className="card-body">
          {cartera && cartera.total > 0 ? (
            <p style={{ margin: 0 }}>Saldo de cartera en tu alcance: <strong>{formatCOP(cartera.total)}</strong> · vencida {formatCOP(cartera.vencido)}.</p>
          ) : (
            <p style={{ margin: 0, color: "var(--muted)" }}>Pendiente de cargar el reporte de Cuentas por Cobrar. Cuando llegue, la cartera aparecerá aquí.</p>
          )}
        </div>
      </div>
    </>
  );
}
