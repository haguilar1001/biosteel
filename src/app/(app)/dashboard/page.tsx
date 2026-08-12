// ==========================================================
// Dashboard — Panel ejecutivo visual: balances, medidores de indicadores,
// anillo de egresos por grupo, barras, mapa de cartera y próximos pagos.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { puede, alcanceDe } from "@/lib/rbac/authorize";
import { formatCOP, formatPorcentaje, formatNumero, formatFecha } from "@/lib/format";
import { flujoMensual, totalesFlujo, presupuestoVsReal, MESES_LABEL } from "@/lib/negocio/flujo";
import { resumenCxp } from "@/lib/negocio/cxp";
import { resumenCartera, carteraPorCiudad } from "@/lib/negocio/cartera";
import { resumenObligaciones, listarObligaciones, tipoLabel, type NivelAlerta } from "@/lib/negocio/obligaciones";
import { calcularIndicadores, type IndicadorCalc } from "@/lib/negocio/indicadores";
import { ventaMensualDetalle } from "@/lib/negocio/ventas";
import { Medidor } from "../_components/charts/Medidor";
import { MapaCartera } from "../_components/charts/MapaCartera";
import { Sparkline } from "../_components/charts/Sparkline";

const ANIO = 2026;
const PRESUPUESTO_VENTA_MES = 2_000_000_000; // meta mensual de venta (COP)
const MESES_FULL = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CATS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];
const AZULES = ["var(--az-1)", "var(--az-2)", "var(--az-3)", "var(--az-4)", "var(--az-5)", "var(--az-6)", "var(--az-7)", "var(--az-8)"];

function fmtInd(v: number, u: IndicadorCalc["unidad"]): string {
  if (u === "cop") return formatCOP(v);
  if (u === "dias") return `${formatNumero(Math.round(v))} días`;
  if (u === "veces") return `${v.toFixed(1).replace(".", ",")} veces`;
  return formatPorcentaje(v);
}

function badgeAlerta(a: NivelAlerta, dias: number | null): { clase: string; texto: string } {
  switch (a) {
    case "vencido": return { clase: "t-bad", texto: `Vencido ${Math.abs(dias ?? 0)}d` };
    case "urgente": return { clase: "t-bad", texto: dias === 0 ? "Hoy" : `En ${dias}d` };
    case "pronto": return { clase: "t-w1", texto: `En ${dias}d` };
    case "ok": return { clase: "t-ok", texto: `En ${dias}d` };
    default: return { clase: "t-blue", texto: "—" };
  }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { usuario } = await requirePermiso("dashboard.view");
  const sp = await searchParams;
  const mesEgr = sp.mes && /^\d+$/.test(sp.mes) ? Number(sp.mes) : undefined;
  const verCxp = await puede(usuario, "cxp.view");
  const alcanceCartera = await alcanceDe(usuario, "cartera.view");
  const alcInd = alcanceCartera === "ninguno" ? "todos" : alcanceCartera;

  const [meses, tot, presup, cxp, oblig, obligLista, indicadores, ventas] = verCxp
    ? await Promise.all([
        flujoMensual(ANIO), totalesFlujo(ANIO), presupuestoVsReal(ANIO, mesEgr),
        resumenCxp(), resumenObligaciones(), listarObligaciones(),
        calcularIndicadores(usuario, alcInd), ventaMensualDetalle(ANIO),
      ])
    : [null, null, null, null, null, null, null, null];

  const cartera = alcanceCartera !== "ninguno" ? await resumenCartera(usuario, alcanceCartera) : null;
  const ciudades = alcanceCartera !== "ninguno" ? await carteraPorCiudad(usuario, alcanceCartera) : [];

  // Egresos por grupo (barras horizontales), de mayor a menor.
  const grupos = (presup ?? []).filter((p) => p.real > 0).sort((a, b) => b.real - a.real);
  const totalEgresos = grupos.reduce((s, g) => s + g.real, 0);
  const maxEgr = grupos.length ? grupos[0]!.real : 1;

  // Medidores: los 4 indicadores no pendientes
  const gauges = (indicadores ?? []).filter((i) => !i.pendiente).slice(0, 4);

  // Mapa
  let idx = 0;
  const colorCiudad = new Map<string, string>();
  for (const c of ciudades) colorCiudad.set(c.ciudad, c.ciudad === "Sin ciudad" ? "var(--muted)" : CATS[idx++ % CATS.length]!);
  const mapaData = ciudades.map((c) => ({ ciudad: c.ciudad, valor: c.saldo, color: colorCiudad.get(c.ciudad)!, ips: c.ips.map((i) => ({ cliente: i.cliente, saldo: i.saldo })) }));

  const maxBar = meses ? Math.max(1, ...meses.map((m) => Math.max(m.ingresos, m.egresos))) : 1;
  const obligOrden = obligLista ? [...obligLista].sort((a, b) => (a.proximaFecha?.getTime() ?? Infinity) - (b.proximaFecha?.getTime() ?? Infinity)) : [];
  const ahora = new Date();
  const hoy = formatFecha(ahora);

  // Mes cerrado que reflejan los medidores Venta/Recaudo (último mes con flujo).
  const mesCerrado = meses && meses.length ? meses[meses.length - 1]!.mes : null;

  // Mes en curso: venta acumulada + proyección lineal a fin de mes (según los
  // días transcurridos) y diferencia contra la meta mensual de venta.
  const mesActual = ahora.getUTCFullYear() === ANIO ? ahora.getUTCMonth() + 1 : 12;
  const diaHoy = ahora.getUTCFullYear() === ANIO ? ahora.getUTCDate() : 31;
  const diasMes = new Date(Date.UTC(ANIO, mesActual, 0)).getUTCDate();
  const ventaMesActual = ventas ? (ventas[mesActual - 1]?.venta ?? 0) : 0;
  const ventaProyectada = diaHoy > 0 ? (ventaMesActual / diaHoy) * diasMes : ventaMesActual;
  const difPresupuesto = ventaProyectada - PRESUPUESTO_VENTA_MES;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inicio</div>
          <h1>Panel de Flujo de Caja</h1>
          <p>Corte a {hoy} · {usuario.rol.nombre}</p>
        </div>
      </div>

      {/* Fila 1 — Venta del mes en curso: acumulada, proyección y dif. vs meta */}
      {verCxp && ventas && (
        <>
          <div style={{ margin: "18px 0 10px", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Informe de {MESES_FULL[mesActual]}</h2>
            <span className="flag" style={{ fontSize: 14 }}>{ANIO} · mes actual · corte día {diaHoy} de {diasMes}</span>
          </div>
          <div className="kpis" style={{ marginBottom: 12 }}>
            <div className="kpi k-ingreso">
              <div className="klabel">Venta del mes</div>
              <div className="kval num">{formatCOP(ventaMesActual)}</div>
              <div className="ksub"><span className="flag">acumulada al día {diaHoy}</span></div>
            </div>
            <div className="kpi">
              <div className="klabel">Proyectado a fin de mes</div>
              <div className="kval num">{formatCOP(ventaProyectada)}</div>
              <div className="ksub"><span className="flag">al ritmo actual ({diaHoy}/{diasMes} días)</span></div>
            </div>
            <div className="kpi">
              <div className="klabel">Presupuesto (meta)</div>
              <div className="kval num">{formatCOP(PRESUPUESTO_VENTA_MES)}</div>
              <div className="ksub"><span className="flag">$2.000M / mes</span></div>
            </div>
            <div className="kpi" style={{ borderLeftColor: difPresupuesto >= 0 ? "var(--ok)" : "var(--bad)" }}>
              <div className="klabel">Diferencia vs presupuesto</div>
              <div className="kval num" style={{ color: difPresupuesto >= 0 ? "var(--ok)" : "var(--bad)" }}>
                {difPresupuesto >= 0 ? "+" : "−"}{formatCOP(Math.abs(difPresupuesto))}
              </div>
              <div className="ksub"><span className="flag">proyectado − presupuesto</span></div>
            </div>
          </div>
        </>
      )}

      {/* Fila 2 — Informe del mes anterior (mes cerrado): título + medidores */}
      {verCxp && mesCerrado && (
        <div style={{ margin: "18px 0 10px", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Informe de {MESES_FULL[mesCerrado]}</h2>
          <span className="flag" style={{ fontSize: 14 }}>{ANIO} · mes anterior</span>
        </div>
      )}

      {gauges.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 12 }}>
          {gauges.map((i) => {
            const color = i.cumple == null ? "var(--muted)" : i.cumple ? "var(--ok)" : "var(--bad)";
            return (
              <div className="card" key={i.num}>
                <div className="chart-head" style={{ fontSize: 11.5 }}>{i.nombre}</div>
                <div className="card-body" style={{ paddingTop: 6 }}>
                  <Medidor valor={Math.min(i.cumplimiento ?? 0, 160)} color={color} size={150} />
                  <div style={{ textAlign: "center", marginTop: 2 }}>
                    <div className="num" style={{ fontSize: 18, fontWeight: 800, color }}>{i.real != null ? fmtInd(i.real, i.unidad) : "—"}</div>
                    <div className="flag">meta {i.metaTexto}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fila 3 — Indicadores clave (balances al corte) */}
      <div style={{ margin: "18px 0 10px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Indicadores Claves</h2>
      </div>
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
          {meses && meses.length > 1 && (
            <div style={{ position: "absolute", right: 12, bottom: 10 }}>
              <Sparkline data={meses.map((m) => m.neto)} color="var(--ingreso)" />
            </div>
          )}
        </div>
      </div>

      {/* Anillo egresos por grupo + barras ingresos/egresos */}
      {verCxp && (
        <div className="grid two" style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="chart-head">¿En qué se va la plata? <span className="hact">egresos por grupo · {mesEgr ? MESES_FULL[mesEgr] : ANIO}</span></div>
            <div className="card-body">
              <form method="get" className="toolbar" style={{ marginBottom: 8 }}>
                <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
                <select name="mes" defaultValue={mesEgr ?? ""} className="select">
                  <option value="">Todos los meses</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{MESES_FULL[m]}</option>
                  ))}
                </select>
                <button type="submit" className="btn primary">Ver</button>
                {mesEgr ? <a href="/dashboard" className="btn">Todos</a> : null}
              </form>
              {grupos.length === 0 ? <div className="empty">Sin egresos{mesEgr ? ` en ${MESES_FULL[mesEgr]}` : ""}.</div> : (
                <>
                  <div className="flag" style={{ marginBottom: 10 }}>Total egresos: <strong className="num">{formatCOP(totalEgresos)}</strong></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {grupos.map((g, idx) => {
                      const pct = totalEgresos > 0 ? (g.real / totalEgresos) * 100 : 0;
                      return (
                        <div key={g.categoria}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                            <span className="rank-label" title={g.categoria} style={{ fontSize: 12.5, fontWeight: 600 }}>{g.categoria}</span>
                            <span className="num" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{formatCOP(g.real)} <span className="flag">· {pct.toFixed(1).replace(".", ",")}%</span></span>
                          </div>
                          <div className="rank-bar"><div style={{ width: `${Math.max(2, (g.real / maxEgr) * 100)}%`, background: AZULES[idx % AZULES.length] }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="card">
            <div className="chart-head">Ingresos vs Egresos por mes <span className="hact">{ANIO}</span></div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 220 }}>
                {meses!.map((m) => (
                  <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
                      <div title={`Ingresos ${formatCOP(m.ingresos)}`} style={{ width: "40%", height: `${Math.max(1, (m.ingresos / maxBar) * 100)}%`, background: "var(--ingreso)", borderRadius: "3px 3px 0 0" }} />
                      <div title={`Egresos ${formatCOP(m.egresos)}`} style={{ width: "40%", height: `${Math.max(1, (m.egresos / maxBar) * 100)}%`, background: "var(--egreso)", borderRadius: "3px 3px 0 0" }} />
                    </div>
                    <span className="flag">{MESES_LABEL[m.mes]}</span>
                  </div>
                ))}
              </div>
              <div className="legend"><span><i style={{ background: "var(--ingreso)" }} />Ingresos</span><span><i style={{ background: "var(--egreso)" }} />Egresos</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Mapa de cartera + próximos pagos */}
      <div className="grid two" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        {cartera && mapaData.length > 0 && (
          <div className="card">
            <div className="chart-head">Cartera por ciudad <a href="/cartera/ciudades?vista=mapa" className="hact" style={{ color: "#fff" }}>ver detalle →</a></div>
            <div className="card-body"><MapaCartera data={mapaData} /></div>
          </div>
        )}
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
                        <td style={{ fontWeight: 600 }}><span style={{ textTransform: "uppercase" }}>{o.entidad}</span> <span className="flag">· {tipoLabel(o.tipo)}</span></td>
                        <td className="r num">{formatCOP(o.saldoCapital)}</td>
                        <td>{o.proximaFecha ? <>{formatFecha(o.proximaFecha)} <span className={`tag ${b.clase}`}>{b.texto}</span></> : "—"}</td>
                        <td className="r num">{o.cuotaMensual != null ? formatCOP(o.cuotaMensual) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
