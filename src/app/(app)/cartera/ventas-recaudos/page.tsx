// ==========================================================
// Cartera › Ventas vs Recaudos por cliente (por mes).
//   Ventas   = reporte "Venta por línea" (VentaCliente), neto del mes.
//   Recaudos = ingresos del Flujo de Caja (abonos a cartera) del mes.
// Se cruzan por nombre normalizado (fuentes distintas: puede haber clientes
// que aparezcan en una sola serie).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatNumero } from "@/lib/format";
import { ventaPorCliente } from "@/lib/negocio/ventas";
import { movimientosPorTercero, mesesConMovimiento, MESES_LABEL } from "@/lib/negocio/flujo";
import { BarrasComparativas, type BarraItem } from "../../_components/charts/BarrasComparativas";

const ANIO = 2026;

/** Normaliza el nombre para cruzar clientes entre fuentes distintas. */
function norm(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // sin tildes
    .replace(/[.,]/g, " ")
    .replace(/\b(S A S|SAS|S A|SA|LTDA|E S E|ESE|IPS|E U|EU)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function VentasRecaudosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requirePermiso("cartera.view");
  const sp = await searchParams;

  const mesesRec = await mesesConMovimiento(ANIO, "ingreso");
  const ultimo = mesesRec.length ? mesesRec[mesesRec.length - 1]! : new Date().getMonth() + 1;
  const mes = sp.mes && /^\d+$/.test(sp.mes) ? Number(sp.mes) : ultimo;

  const [ventas, recaudos] = await Promise.all([
    ventaPorCliente(ANIO, [mes]),
    movimientosPorTercero("ingreso", { anio: ANIO, mes }),
  ]);

  // Cruce por nombre normalizado.
  const mapa = new Map<string, { label: string; ventas: number; recaudos: number }>();
  for (const v of ventas) {
    const k = norm(v.clienteNombre);
    const e = mapa.get(k) ?? { label: v.clienteNombre, ventas: 0, recaudos: 0 };
    e.ventas += v.valor;
    mapa.set(k, e);
  }
  for (const r of recaudos) {
    const k = norm(r.terceroNombre);
    const e = mapa.get(k) ?? { label: r.terceroNombre, ventas: 0, recaudos: 0 };
    e.recaudos += r.total;
    // Prefiere un nombre "con letras" legible si el de ventas venía vacío.
    if (!e.ventas) e.label = r.terceroNombre;
    mapa.set(k, e);
  }

  const filas = [...mapa.values()].sort((a, b) => Math.max(b.ventas, b.recaudos) - Math.max(a.ventas, a.recaudos));
  const totVentas = ventas.reduce((s, v) => s + v.valor, 0);
  const totRecaudos = recaudos.reduce((s, r) => s + r.total, 0);

  const items: BarraItem[] = filas
    .filter((f) => f.ventas > 0 || f.recaudos > 0)
    .map((f) => ({ label: f.label, a: f.ventas, b: f.recaudos }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cartera</div>
          <h1>Ventas vs Recaudos</h1>
          <p>Por cliente · {MESES_LABEL[mes]} {ANIO} · ventas (facturación) contra recaudos (abonos)</p>
        </div>
        <div className="toolbar">
          <a href="/cartera/clientes" className="btn">Por cliente (saldo)</a>
          <a href="/cartera" className="btn">← Facturas</a>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <form method="get" className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
            <select name="mes" defaultValue={mes} className="select">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES_LABEL[m]}</option>
              ))}
            </select>
            <button type="submit" className="btn primary">Ver</button>
          </form>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="klabel">Ventas del mes</div>
          <div className="kval num" style={{ color: "var(--cat-1)" }}>{formatCOP(totVentas)}</div>
          <div className="ksub"><span className="flag">facturación neta (por línea)</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">Recaudos del mes</div>
          <div className="kval num" style={{ color: "var(--cat-3)" }}>{formatCOP(totRecaudos)}</div>
          <div className="ksub"><span className="flag">abonos a cartera</span></div>
        </div>
        <div className={`kpi ${totRecaudos - totVentas >= 0 ? "k-ok" : "k-w"}`}>
          <div className="klabel">Recaudo − Venta</div>
          <div className="kval num">{formatCOP(totRecaudos - totVentas)}</div>
          <div className="ksub"><span className="flag">{totRecaudos >= totVentas ? "se recaudó más de lo vendido" : "se vendió más de lo recaudado"}</span></div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <BarrasComparativas
          titulo={`Ventas vs Recaudos · ${MESES_LABEL[mes]}`}
          items={items}
          labelA="Ventas" labelB="Recaudos"
          colorA="var(--cat-1)" colorB="var(--cat-3)"
          inicial={12} step={6}
        />
      </div>

      <div className="card">
        <div className="chart-head">Detalle por cliente <span className="hact">{formatNumero(items.length)} clientes</span></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Cliente</th><th className="r">Ventas</th><th className="r">Recaudos</th><th className="r">Recaudo − Venta</th></tr>
            </thead>
            <tbody>
              {items.length > 0 && (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total · {formatNumero(items.length)} clientes</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totVentas)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totRecaudos)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totRecaudos - totVentas)}</td>
                </tr>
              )}
              {filas.length === 0 ? (
                <tr><td colSpan={4} className="empty">Sin datos para {MESES_LABEL[mes]}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.label}>
                    <td style={{ fontWeight: 600 }} title={f.label}>{f.label}</td>
                    <td className="r num" style={{ color: "var(--cat-1)" }}>{f.ventas ? formatCOP(f.ventas) : "—"}</td>
                    <td className="r num" style={{ color: "var(--cat-3)" }}>{f.recaudos ? formatCOP(f.recaudos) : "—"}</td>
                    <td className="r num" style={{ fontWeight: 700, color: f.recaudos - f.ventas < 0 ? "var(--w1)" : "var(--ok)" }}>{formatCOP(f.recaudos - f.ventas)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
