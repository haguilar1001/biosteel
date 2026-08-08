// ==========================================================
// Indicadores Financieros (Contabilidad) — medidores y semáforos.
// Filtro por mes con selección múltiple (suma el período) para los
// indicadores mensuales; los de saldo actual son foto de hoy.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { alcanceDe } from "@/lib/rbac/authorize";
import { formatCOP, formatPorcentaje, formatNumero } from "@/lib/format";
import { calcularIndicadores, type IndicadorCalc } from "@/lib/negocio/indicadores";
import { flujoMensual } from "@/lib/negocio/flujo";
import { ventaPorLinea } from "@/lib/negocio/ventas";
import { Medidor } from "../_components/charts/Medidor";
import { Donut } from "../_components/charts/Donut";

const CAT = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];

const ANIO = 2026;
const MES_ABBR = ["", "ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function fmtValor(v: number, unidad: IndicadorCalc["unidad"]): string {
  switch (unidad) {
    case "cop": return formatCOP(v);
    case "dias": return `${formatNumero(Math.round(v))} días`;
    case "pct": return formatPorcentaje(v);
    case "veces": return `${v.toFixed(1).replace(".", ",")} veces`;
  }
}

export default async function IndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string }>;
}) {
  const { usuario } = await requirePermiso("cxp.view");
  const alcanceCartera = await alcanceDe(usuario, "cartera.view");
  const alcInd = alcanceCartera === "ninguno" ? "todos" : alcanceCartera;

  // Meses con datos (para habilitar chips) y último con datos (default).
  const meses = await flujoMensual(ANIO);
  const conDatos = meses.filter((m) => m.ingresos > 0 || m.egresos > 0).map((m) => m.mes);
  const ultimo = conDatos.length ? conDatos[conDatos.length - 1]! : null;

  // Selección desde la URL (?meses=1,2,3); default = último mes con datos.
  const sp = await searchParams;
  const pedidos = (sp.meses ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && conDatos.includes(n));
  const seleccion = pedidos.length ? [...new Set(pedidos)].sort((a, b) => a - b)
    : (ultimo ? [ultimo] : []);

  const [indicadores, lineas] = await Promise.all([
    calcularIndicadores(usuario, alcInd, seleccion),
    ventaPorLinea(ANIO, seleccion),
  ]);
  const totalLineas = lineas.reduce((s, l) => s + l.valor, 0);
  // Agrupa la cola en "Otras" para un anillo legible (top 7 + resto).
  const topLineas = lineas.slice(0, 7);
  const restoLineas = lineas.slice(7).reduce((s, l) => s + l.valor, 0);
  const donutLineas = [
    ...topLineas.map((l, i) => ({ label: l.linea.replace(/^\d+\s*-\s*/, ""), valor: l.valor, color: CAT[i % CAT.length]! })),
    ...(restoLineas > 0 ? [{ label: "Otras", valor: restoLineas, color: "var(--muted)" }] : []),
  ];

  const cumplen = indicadores.filter((i) => i.cumple === true).length;
  const conDato = indicadores.filter((i) => i.cumple != null).length;

  // Construye el href al alternar (toggle) un mes en la selección.
  const hrefToggle = (m: number) => {
    const set = new Set(seleccion);
    if (set.has(m)) set.delete(m); else set.add(m);
    const arr = [...set].sort((a, b) => a - b);
    return arr.length ? `/indicadores?meses=${arr.join(",")}` : "/indicadores";
  };
  const periodoLabel = seleccion.map((m) => MES_ABBR[m]).join(" · ");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Contabilidad</div>
          <h1>Indicadores Financieros</h1>
          <p>{formatNumero(cumplen)} de {formatNumero(conDato)} indicadores en meta · corte {ANIO_LABEL()}</p>
        </div>
      </div>

      {/* Filtro por mes (multi-selección) */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">
          Período de los indicadores mensuales
          <span className="hact">{periodoLabel || "sin datos"}{seleccion.length > 1 ? ` · ${seleccion.length} meses (suma)` : ""}</span>
        </div>
        <div className="card-body" style={{ paddingTop: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {MES_ABBR.slice(1).map((lbl, i) => {
              const m = i + 1;
              const hayDatos = conDatos.includes(m);
              const activo = seleccion.includes(m);
              if (!hayDatos) {
                return (
                  <span key={m} className="mes-chip off" aria-disabled title="Sin movimientos">{lbl}</span>
                );
              }
              return (
                <a key={m} href={hrefToggle(m)} className={`mes-chip${activo ? " on" : ""}`}>{lbl}</a>
              );
            })}
          </div>
          <p className="flag" style={{ marginTop: 10 }}>
            Utilidad (#26) y DSO (#31) se calculan sobre el período seleccionado (suma). Los de saldo actual
            (% cartera vencida, rotación CxP) son foto de hoy y no cambian con el mes.
          </p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {indicadores.map((i) => {
          const color = i.cumple == null ? "var(--muted)" : i.cumple ? "var(--ok)" : "var(--bad)";
          const semaforo = i.cumple == null
            ? <span className="tag t-w1">Sin dato</span>
            : i.cumple ? <span className="tag t-ok">✓ En meta</span> : <span className="tag t-bad">✗ Fuera de meta</span>;
          return (
            <div className="card" key={i.num}>
              <div className="chart-head">
                <span>#{i.num} · {i.nombre}</span>
                <span className="hact">{i.frecuencia}</span>
              </div>
              <div className="card-body">
                {i.pendiente || i.cumplimiento == null ? (
                  <div style={{ height: 112, display: "grid", placeItems: "center", textAlign: "center" }}>
                    <div>
                      <div className="kval num" style={{ fontSize: 26, color: "var(--muted)" }}>—</div>
                      <div className="flag">pendiente de dato</div>
                    </div>
                  </div>
                ) : (
                  <Medidor valor={Math.min(i.cumplimiento, 160)} color={color} size={190} />
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
                  <div className="num" style={{ fontSize: 22, fontWeight: 800, color }}>
                    {i.real != null ? fmtValor(i.real, i.unidad) : "—"}
                  </div>
                  {semaforo}
                </div>
                <div className="flag" style={{ marginTop: 4 }}>Meta: {i.metaTexto}</div>
                <div className="flag" style={{ marginTop: 6, fontStyle: "italic" }}>ƒ = {i.formula}</div>
                {i.nota && <div className="flag" style={{ marginTop: 6, color: "var(--muted)" }}>ⓘ {i.nota}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Venta por Línea (período seleccionado) */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="chart-head">
          Venta por Línea
          <span className="hact">{periodoLabel || "sin datos"} · {formatCOP(totalLineas)}</span>
        </div>
        <div className="card-body">
          {lineas.length === 0 ? (
            <div className="empty">Sin ventas cargadas. Corre <code>npm run db:ventas</code> para importar el reporte por línea.</div>
          ) : (
            <div className="grid two" style={{ gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "center" }}>
              <div style={{ display: "grid", placeItems: "center" }}>
                <Donut legend={false} size={220} data={donutLineas}
                  centro={{ valor: (totalLineas / 1e9).toFixed(1).replace(".", ",") + " MM", etiqueta: "venta neta" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lineas.map((l, i) => (
                  <div key={l.linea}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600 }} title={l.linea}>
                        <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: i < 7 ? CAT[i % CAT.length] : "var(--muted)", marginRight: 7 }} />
                        {l.linea}
                      </span>
                      <span className="num" style={{ fontWeight: 700 }}>{formatCOP(l.valor)} · {formatPorcentaje(totalLineas > 0 ? (l.valor / totalLineas) * 100 : 0)}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 5, background: "var(--brand-tint)", overflow: "hidden" }}>
                      <div style={{ width: `${totalLineas > 0 ? Math.max(1, (l.valor / totalLineas) * 100) : 0}%`, height: "100%", background: i < 7 ? CAT[i % CAT.length] : "var(--muted)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ANIO_LABEL() {
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date());
}
