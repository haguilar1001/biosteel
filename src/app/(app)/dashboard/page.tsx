// ==========================================================
// Dashboard — Panel ejecutivo visual: balances, medidores de indicadores,
// anillo de egresos por grupo, barras, mapa de cartera y próximos pagos.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { puede, alcanceDe } from "@/lib/rbac/authorize";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { flujoMensual, totalesFlujo, presupuestoVsReal, MESES_LABEL } from "@/lib/negocio/flujo";
import { resumenCxp } from "@/lib/negocio/cxp";
import { resumenCartera, carteraPorCiudad } from "@/lib/negocio/cartera";
import { resumenObligaciones, listarObligaciones, tipoLabel, type NivelAlerta } from "@/lib/negocio/obligaciones";
import { calcularIndicadores, type IndicadorCalc } from "@/lib/negocio/indicadores";
import { Donut } from "../_components/charts/Donut";
import { Medidor } from "../_components/charts/Medidor";
import { MapaCartera } from "../_components/charts/MapaCartera";

const ANIO = 2026;
const CATS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];

function fmtInd(v: number, u: IndicadorCalc["unidad"]): string {
  if (u === "cop") return formatCOP(v);
  if (u === "dias") return `${Math.round(v)} días`;
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
const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(d);

export default async function DashboardPage() {
  const { usuario } = await requirePermiso("dashboard.view");
  const verCxp = await puede(usuario, "cxp.view");
  const alcanceCartera = await alcanceDe(usuario, "cartera.view");
  const alcInd = alcanceCartera === "ninguno" ? "todos" : alcanceCartera;

  const [meses, tot, presup, cxp, oblig, obligLista, indicadores] = verCxp
    ? await Promise.all([
        flujoMensual(ANIO), totalesFlujo(ANIO), presupuestoVsReal(ANIO),
        resumenCxp(), resumenObligaciones(), listarObligaciones(),
        calcularIndicadores(usuario, alcInd),
      ])
    : [null, null, null, null, null, null, null];

  const cartera = alcanceCartera !== "ninguno" ? await resumenCartera(usuario, alcanceCartera) : null;
  const ciudades = alcanceCartera !== "ninguno" ? await carteraPorCiudad(usuario, alcanceCartera) : [];

  // Anillo: egresos por grupo (top 6 + Otros)
  const grupos = (presup ?? []).filter((p) => p.real > 0).sort((a, b) => b.real - a.real);
  const top = grupos.slice(0, 6);
  const otros = grupos.slice(6).reduce((s, g) => s + g.real, 0);
  const donutEgresos = [
    ...top.map((g, i) => ({ label: g.categoria, valor: g.real, color: CATS[i % CATS.length]! })),
    ...(otros > 0 ? [{ label: "Otros", valor: otros, color: "var(--muted)" }] : []),
  ];
  const totalEgresos = grupos.reduce((s, g) => s + g.real, 0);

  // Medidores: los 4 indicadores no pendientes
  const gauges = (indicadores ?? []).filter((i) => !i.pendiente).slice(0, 4);

  // Mapa
  let idx = 0;
  const colorCiudad = new Map<string, string>();
  for (const c of ciudades) colorCiudad.set(c.ciudad, c.ciudad === "Sin ciudad" ? "var(--muted)" : CATS[idx++ % CATS.length]!);
  const mapaData = ciudades.map((c) => ({ ciudad: c.ciudad, valor: c.saldo, color: colorCiudad.get(c.ciudad)!, ips: c.ips.map((i) => ({ cliente: i.cliente, saldo: i.saldo })) }));

  const maxBar = meses ? Math.max(1, ...meses.map((m) => Math.max(m.ingresos, m.egresos))) : 1;
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

      {/* Balances */}
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

      {/* Medidores de indicadores */}
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

      {/* Anillo egresos por grupo + barras ingresos/egresos */}
      {verCxp && (
        <div className="grid two" style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="chart-head">¿En qué se va la plata? <span className="hact">egresos por grupo {ANIO}</span></div>
            <div className="card-body">
              {donutEgresos.length === 0 ? <div className="empty">Sin egresos.</div> : (
                <Donut data={donutEgresos} centro={{ valor: (totalEgresos / 1e9).toFixed(1).replace(".", ",") + " MM", etiqueta: "egresos" }} />
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
      </div>
    </>
  );
}
