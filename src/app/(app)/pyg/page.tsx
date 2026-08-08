// ==========================================================
// Estado de Resultados (PyG) — mes a mes y acumulado, con un motor de
// análisis financiero que redacta conclusiones automáticas.
// Fuente: EstadoResultados (importado de los PDF mensuales, ver set-pyg.ts).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { listarPyg, acumuladoPyg, type PygMes } from "@/lib/negocio/pyg";
import { analizarPyg, type Conclusion, type Tono } from "@/lib/negocio/pyg-analisis";
import { MESES_LABEL } from "@/lib/negocio/flujo";
import { Sparkline } from "../_components/charts/Sparkline";

const ANIO = 2026;
const TONO_TAG: Record<Tono, string> = { ok: "t-ok", warn: "t-w1", bad: "t-bad", info: "t-blue" };
const TONO_ICON: Record<Tono, string> = { ok: "✓", warn: "▲", bad: "✕", info: "ℹ" };

function ListaConclusiones({ items }: { items: Conclusion[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
          <span className={`tag ${TONO_TAG[c.tono]}`} style={{ flex: "0 0 auto" }}>{TONO_ICON[c.tono]}</span>
          <span>{c.texto}</span>
        </div>
      ))}
    </div>
  );
}

export default async function PygPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string; vista?: string }>;
}) {
  await requirePermiso("cxp.view");

  const meses = await listarPyg(ANIO);
  const acc = acumuladoPyg(meses);
  const analisis = analizarPyg(meses, acc);

  if (meses.length === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow">Contabilidad</div>
            <h1>Estado de Resultados (PyG)</h1>
          </div>
        </div>
        <div className="card"><div className="card-body">
          <div className="empty">
            Aún no hay Estados de Resultados cargados. Corre <code>npm run db:pyg</code> para importar los PDF mensuales.
          </div>
        </div></div>
      </>
    );
  }

  // Filtro (multi-mes) y vista, al nivel del Estado de Resultados.
  // Las tarjetas KPI de arriba se mantienen sobre el acumulado completo.
  const sp = await searchParams;
  const disponibles = meses.map((m) => m.mes);
  const pedidos = (sp.meses ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && disponibles.includes(n));
  const seleccion = pedidos.length ? [...new Set(pedidos)].sort((a, b) => a - b) : disponibles;
  const mesesSel = meses.filter((m) => seleccion.includes(m.mes));
  const accSel = acumuladoPyg(mesesSel);
  const vertical = sp.vista === "vertical";

  // Href para los controles del Estado de Resultados (conserva vista/meses).
  const qs = (mm: number[], v: boolean) => {
    const p = new URLSearchParams();
    if (mm.length && mm.length < disponibles.length) p.set("meses", mm.join(","));
    if (v) p.set("vista", "vertical");
    const s = p.toString();
    return s ? `/pyg?${s}` : "/pyg";
  };
  const hrefMes = (mes: number) => {
    const set = new Set(seleccion);
    if (set.has(mes)) set.delete(mes); else set.add(mes);
    const arr = [...set].sort((a, b) => a - b);
    return qs(arr.length ? arr : disponibles, vertical);
  };

  // Filas del P&L — solo valores (los % se ven en la vista de Análisis vertical).
  const filas: { label: string; get: (m: PygMes) => number; accGet: () => number; fuerte?: boolean; neg?: boolean }[] = [
    { label: "Ventas netas", get: (m) => m.ventasNetas, accGet: () => accSel.ventasNetas, fuerte: true },
    { label: "(−) Costo de venta", get: (m) => m.costoVenta, accGet: () => accSel.costoVenta, neg: true },
    { label: "Utilidad bruta", get: (m) => m.utilidadBruta, accGet: () => accSel.utilidadBruta, fuerte: true },
    { label: "(−) Gastos operativos", get: (m) => m.gastosOperacionales, accGet: () => accSel.gastosOperacionales, neg: true },
    { label: "Utilidad operacional", get: (m) => m.utilidadOperacional, accGet: () => accSel.utilidadOperacional, fuerte: true },
    { label: "(+) Ingresos no op.", get: (m) => m.ingresosNoOp, accGet: () => accSel.ingresosNoOp },
    { label: "(−) Egresos no op.", get: (m) => m.egresosNoOp, accGet: () => accSel.egresosNoOp, neg: true },
    { label: "Utilidad neta", get: (m) => m.utilidadNeta, accGet: () => accSel.utilidadNeta, fuerte: true },
  ];
  // Análisis vertical: cada renglón como % de las Ventas netas de esa columna.
  const vpct = (valor: number, base: number) => (base > 0 ? formatPorcentaje((valor / base) * 100) : "—");

  const trendVentas = meses.map((m) => m.ventasNetas);
  const trendBruta = meses.map((m) => m.utilidadBruta);
  const trendOper = meses.map((m) => m.utilidadOperacional);
  const trendNeta = meses.map((m) => m.utilidadNeta);
  const trendMargen = meses.map((m) => m.margenNeto);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Contabilidad · Skill financiera</div>
          <h1>Estado de Resultados (PyG)</h1>
          <p>{acc.meses} mes{acc.meses === 1 ? "" : "es"} · {MESES_LABEL[meses[0]!.mes]}–{MESES_LABEL[meses[meses.length - 1]!.mes]} {ANIO}</p>
        </div>
      </div>

      {/* KPIs acumulados — título, valor y mini-gráfico centrados. */}
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi kc">
          <div className="klabel">Ventas netas (acum.)</div>
          <div className="kval num">{formatCOP(acc.ventasNetas)}</div>
          <div className="ksub"><Sparkline data={trendVentas} width={120} /></div>
        </div>
        <div className="kpi kc k-ok">
          <div className="klabel">Utilidad bruta</div>
          <div className="kval num">{formatCOP(acc.utilidadBruta)}</div>
          <div className="ksub"><Sparkline data={trendBruta} width={120} /> <span className="flag">margen {formatPorcentaje(acc.margenBruto)}</span></div>
        </div>
        <div className="kpi kc">
          <div className="klabel">Utilidad operacional</div>
          <div className="kval num">{formatCOP(acc.utilidadOperacional)}</div>
          <div className="ksub"><Sparkline data={trendOper} width={120} /> <span className="flag">margen {formatPorcentaje(acc.margenOperacional)}</span></div>
        </div>
        <div className={`kpi kc ${acc.utilidadNeta >= 0 ? "k-ok" : "k-bad"}`}>
          <div className="klabel">Utilidad neta</div>
          <div className="kval num">{formatCOP(acc.utilidadNeta)}</div>
          <div className="ksub"><Sparkline data={trendNeta} color="var(--ok)" width={120} /> <span className="flag">margen {formatPorcentaje(acc.margenNeto)}</span></div>
        </div>
      </div>

      {/* Tabla P&L mes a mes + acumulado */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">
          Estado de Resultados · mes a mes
          <span className="hact">{vertical ? "análisis vertical · % de ventas netas" : "valores en COP"}</span>
        </div>

        {/* Filtros del Estado de Resultados: meses (multi) + vista. */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span className="flag" style={{ fontWeight: 700 }}>Meses:</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {meses.map((m) => {
              const activo = seleccion.includes(m.mes);
              return <a key={m.mes} href={hrefMes(m.mes)} className={`mes-chip${activo ? " on" : ""}`}>{MESES_LABEL[m.mes]}</a>;
            })}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <a href={qs(seleccion, false)} className={`btn${!vertical ? " primary" : ""}`}>Valores $</a>
            <a href={qs(seleccion, true)} className={`btn${vertical ? " primary" : ""}`}>% Vertical</a>
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Concepto</th>
                {mesesSel.map((m) => <th key={m.mes} className="r">{MESES_LABEL[m.mes]}</th>)}
                <th className="r" style={{ background: "var(--brand-tint)" }}>Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.label} className={f.fuerte ? "fila-total" : undefined}>
                  <td style={{ fontWeight: f.fuerte ? 800 : 600, whiteSpace: "pre" }}>{f.label}</td>
                  {mesesSel.map((m) => (
                    <td key={m.mes} className="r num" style={{ color: f.neg ? "var(--egreso)" : undefined, fontWeight: f.fuerte ? 800 : undefined }}>
                      {vertical ? vpct(f.get(m), m.ventasNetas) : formatCOP(f.get(m))}
                    </td>
                  ))}
                  <td className="r num" style={{ background: "var(--brand-tint)", fontWeight: f.fuerte ? 800 : 700 }}>
                    {vertical ? vpct(f.accGet(), accSel.ventasNetas) : formatCOP(f.accGet())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Análisis acumulado */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">🧠 Análisis financiero — acumulado <span className="hact">margen neto {formatPorcentaje(acc.margenNeto)}</span></div>
        <div className="card-body">
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div className="flag">Tendencia utilidad neta</div>
              <Sparkline data={trendNeta} color="var(--ok)" width={160} height={40} />
            </div>
            <div>
              <div className="flag">Tendencia margen neto</div>
              <Sparkline data={trendMargen} color="var(--brand)" width={160} height={40} />
            </div>
          </div>
          <ListaConclusiones items={analisis.acumulado} />
        </div>
      </div>

      {/* Análisis mes a mes */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
        {analisis.mensual.map((am) => {
          const m = meses.find((x) => x.mes === am.mes)!;
          return (
            <div className="card" key={am.mes}>
              <div className="chart-head">
                <span>{MESES_LABEL[am.mes]} {ANIO}</span>
                <span className="hact">neta {formatCOP(m.utilidadNeta)} · {formatPorcentaje(m.margenNeto)}</span>
              </div>
              <div className="card-body"><ListaConclusiones items={am.conclusiones} /></div>
            </div>
          );
        })}
      </div>
    </>
  );
}
