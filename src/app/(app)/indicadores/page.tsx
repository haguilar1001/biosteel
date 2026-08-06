// ==========================================================
// Indicadores Financieros (Contabilidad) — medidores y semáforos.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { alcanceDe } from "@/lib/rbac/authorize";
import { formatCOP, formatPorcentaje, formatNumero } from "@/lib/format";
import { calcularIndicadores, type IndicadorCalc } from "@/lib/negocio/indicadores";
import { Medidor } from "../_components/charts/Medidor";

function fmtValor(v: number, unidad: IndicadorCalc["unidad"]): string {
  switch (unidad) {
    case "cop": return formatCOP(v);
    case "dias": return `${formatNumero(Math.round(v))} días`;
    case "pct": return formatPorcentaje(v);
    case "veces": return `${v.toFixed(1).replace(".", ",")} veces`;
  }
}

export default async function IndicadoresPage() {
  const { usuario } = await requirePermiso("cxp.view");
  const alcanceCartera = await alcanceDe(usuario, "cartera.view");
  const indicadores = await calcularIndicadores(usuario, alcanceCartera === "ninguno" ? "todos" : alcanceCartera);

  const cumplen = indicadores.filter((i) => i.cumple === true).length;
  const conDato = indicadores.filter((i) => i.cumple != null).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Contabilidad</div>
          <h1>Indicadores Financieros</h1>
          <p>{cumplen} de {conDato} indicadores en meta · corte {ANIO_LABEL()}</p>
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
    </>
  );
}

function ANIO_LABEL() {
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date());
}
