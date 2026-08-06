// ==========================================================
// Dashboard — Panel ejecutivo de flujo de caja.
// Integra cartera (CxC), cuentas por pagar (CxP), obligaciones
// financieras y flujo/presupuesto, respetando permisos y alcance.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { puede, alcanceDe } from "@/lib/rbac/authorize";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { flujoMensual, totalesFlujo, presupuestoVsReal, MESES_LABEL } from "@/lib/negocio/flujo";
import { resumenCxp } from "@/lib/negocio/cxp";
import { resumenCartera, carteraPorCliente } from "@/lib/negocio/cartera";
import { resumenObligaciones, listarObligaciones, tipoLabel, type NivelAlerta } from "@/lib/negocio/obligaciones";

const ANIO = 2026;

function badgeAlerta(alerta: NivelAlerta, dias: number | null): { clase: string; texto: string } {
  switch (alerta) {
    case "vencido": return { clase: "t-bad", texto: `Vencido ${Math.abs(dias ?? 0)}d` };
    case "urgente": return { clase: "t-bad", texto: dias === 0 ? "Hoy" : `En ${dias}d` };
    case "pronto": return { clase: "t-w1", texto: `En ${dias}d` };
    case "ok": return { clase: "t-ok", texto: `En ${dias}d` };
    default: return { clase: "t-blue", texto: "—" };
  }
}
const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(d);

export default async function DashboardPage() {
  const { usuario } = await requirePermiso("dashboard.view");
  const verCxp = await puede(usuario, "cxp.view");
  const alcanceCartera = await alcanceDe(usuario, "cartera.view");

  const [meses, tot, presup, cxp, oblig, obligLista] = verCxp
    ? await Promise.all([
        flujoMensual(ANIO), totalesFlujo(ANIO), presupuestoVsReal(ANIO),
        resumenCxp(), resumenObligaciones(), listarObligaciones(),
      ])
    : [null, null, null, null, null, null];

  const cartera = alcanceCartera !== "ninguno" ? await resumenCartera(usuario, alcanceCartera) : null;
  const topClientes = alcanceCartera !== "ninguno" ? (await carteraPorCliente(usuario, alcanceCartera)).slice(0, 6) : [];

  const maxBar = meses ? Math.max(1, ...meses.map((m) => Math.max(m.ingresos, m.egresos))) : 1;
  const topPresup = presup ? [...presup].sort((a, b) => b.real - a.real).slice(0, 6) : [];
  const maxPresup = Math.max(1, ...topPresup.map((p) => Math.max(p.presupuesto, p.real)));
  const obligOrden = obligLista ? [...obligLista].sort((a, b) => (a.proximaFecha?.getTime() ?? Infinity) - (b.proximaFecha?.getTime() ?? Infinity)) : [];

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

      {/* KPIs de balances */}
      <div className="kpis">
        <div className="kpi">
          <div className="klabel">Cartera (por cobrar)</div>
          <div className="kval num">{cartera ? formatCOP(cartera.total) : "—"}</div>
          <div className="ksub"><span className="flag">{cartera ? `vencida ${formatCOP(cartera.vencido)}` : "sin acceso"}</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">Cuentas por pagar</div>
          <div className="kval num">{cxp ? formatCOP(cxp.total) : "—"}</div>
          <div className="ksub"><span className="flag">{cxp ? `vencida ${formatCOP(cxp.vencido)}` : "sin acceso"}</span></div>
        </div>
        <div className="kpi k-egreso">
          <div className="klabel">Obligaciones financieras</div>
          <div className="kval num">{oblig ? formatCOP(oblig.totalSaldo) : "—"}</div>
          <div className="ksub"><span className="flag">{oblig ? `cuota mensual ${formatCOP(oblig.totalCuotaMensual)}` : ""}</span></div>
        </div>
        <div className="kpi k-ingreso">
          <div className="klabel">Flujo neto {ANIO}</div>
          <div className="kval num" style={{ color: tot && tot.neto < 0 ? "var(--bad)" : undefined }}>{tot ? formatCOP(tot.neto) : "—"}</div>
          <div className="ksub"><span className="flag">{tot ? `ejecución presup. ${formatPorcentaje(tot.ejecucion)}` : ""}</span></div>
        </div>
      </div>

      {verCxp && meses && (
        <div className="grid two" style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="chart-head">Ingresos vs Egresos por mes <span className="hact">{ANIO}</span></div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160 }}>
                {meses.map((m) => (
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
              {topPresup.length === 0 ? <div className="empty">Sin datos.</div> : (
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
      )}

      <div className="grid two">
        {verCxp && (
          <div className="card">
            <div className="chart-head">Próximos pagos · obligaciones</div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Entidad</th><th className="r">Saldo</th><th>Próximo pago</th><th className="r">Cuota</th></tr></thead>
                <tbody>
                  {obligOrden.map((o) => {
                    const b = badgeAlerta(o.alerta, o.diasHasta);
                    return (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}>{o.entidad} <span className="flag">· {tipoLabel(o.tipo)}</span></td>
                        <td className="r num">{formatCOP(o.saldoCapital)}</td>
                        <td>{o.proximaFecha ? <>{fmtFecha(o.proximaFecha)} <span className={`tag ${b.clase}`}>{b.texto}</span></> : "—"}</td>
                        <td className="r num">{o.cuotaMensual != null ? formatCOP(o.cuotaMensual) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {cartera && (
          <div className="card">
            <div className="chart-head">Top clientes por cobrar <span className="hact">{topClientes.length}</span></div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Cliente</th><th className="r">Saldo neto</th><th className="r">Vencido</th></tr></thead>
                <tbody>
                  {topClientes.length === 0 ? (
                    <tr><td colSpan={3} className="empty">Sin cartera.</td></tr>
                  ) : (
                    topClientes.map((c) => (
                      <tr key={c.clienteId}>
                        <td style={{ fontWeight: 600 }} title={c.cliente}>{c.cliente}</td>
                        <td className="r num">{formatCOP(c.saldoNeto)}</td>
                        <td className="r num" style={{ color: c.vencido > 0 ? "var(--bad)" : "var(--muted)" }}>{formatCOP(c.vencido)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
