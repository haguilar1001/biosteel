// Ingresos: movimientos de entrada (recaudos, préstamos, ventas de contado…).
// Dos vistas: "Detalle" (movimiento a movimiento) y "Por cliente" (total por
// tercero, mayor a menor) — ambas respetan el filtro de mes y el buscador.
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatNumero, formatPorcentaje } from "@/lib/format";
import { listarMovimientos, movimientosPorTercero, MESES_LABEL } from "@/lib/negocio/flujo";
import { TopRanking, type RankItem } from "../../_components/charts/TopRanking";

const ANIO = 2026;
const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(d);

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; q?: string; vista?: string }>;
}) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;
  const mes = sp.mes && /^\d+$/.test(sp.mes) ? Number(sp.mes) : undefined;
  const q = sp.q;
  const vista = sp.vista === "cliente" ? "cliente" : "detalle";

  const qs = (v: string) => {
    const p = new URLSearchParams();
    if (mes) p.set("mes", String(mes));
    if (q) p.set("q", q);
    if (v === "cliente") p.set("vista", "cliente");
    const s = p.toString();
    return `/flujo/ingresos${s ? `?${s}` : ""}`;
  };

  const filtros = (
    <form method="get" className="toolbar">
      {vista === "cliente" && <input type="hidden" name="vista" value="cliente" />}
      <select name="mes" defaultValue={mes ?? ""} className="select">
        <option value="">Todos los meses</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>{MESES_LABEL[m]}</option>
        ))}
      </select>
      <input type="search" name="q" defaultValue={q ?? ""} placeholder="Tercero, NIT, observación…" className="select" style={{ minWidth: 220 }} />
      <button type="submit" className="btn primary">Filtrar</button>
      <a href={qs(vista)} className="btn">Limpiar</a>
      <span style={{ flex: 1 }} />
      <a href={qs("detalle")} className={`btn${vista === "detalle" ? " primary" : ""}`}>Detalle</a>
      <a href={qs("cliente")} className={`btn${vista === "cliente" ? " primary" : ""}`}>Por cliente</a>
    </form>
  );

  if (vista === "cliente") {
    const filas = await movimientosPorTercero("ingreso", { anio: ANIO, mes, q });
    const total = filas.reduce((s, f) => s + f.total, 0);
    const rank: RankItem[] = filas.map((f) => ({ label: f.terceroNombre, valor: f.total, sub: `${formatNumero(f.movimientos)} mov.` }));
    return (
      <div className="card">
        <div className="chart-head">Ingresos {ANIO} · por cliente <span className="hact">{mes ? MESES_LABEL[mes] : "todos los meses"}</span></div>
        <div className="card-body" style={{ paddingBottom: 0 }}>{filtros}</div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <TopRanking titulo="Mayores clientes por recaudo" items={rank} color="var(--ingreso)" inicial={10} step={5} />
        </div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <colgroup><col style={{ width: "6%" }} /><col style={{ width: "48%" }} /><col style={{ width: "16%" }} /><col style={{ width: "18%" }} /><col style={{ width: "12%" }} /></colgroup>
            <thead><tr><th>#</th><th>Cliente</th><th className="r">Movimientos</th><th className="r">Total</th><th className="r">% Part.</th></tr></thead>
            <tbody>
              <tr className="fila-total">
                <td></td><td style={{ fontWeight: 800 }}>Total · {formatNumero(filas.length)} cliente{filas.length === 1 ? "" : "s"}</td>
                <td></td><td className="r num" style={{ fontWeight: 800 }}>{formatCOP(total)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
              </tr>
              {filas.length === 0 ? (
                <tr><td colSpan={5} className="empty">Sin movimientos.</td></tr>
              ) : (
                filas.map((f, i) => (
                  <tr key={f.terceroNombre}>
                    <td className="num flag">{i + 1}</td>
                    <td style={{ fontWeight: 600 }} title={f.terceroNombre}>{f.terceroNombre}</td>
                    <td className="r num">{formatNumero(f.movimientos)}</td>
                    <td className="r num" style={{ fontWeight: 700, color: "var(--ingreso)" }}>{formatCOP(f.total)}</td>
                    <td className="r num">{total > 0 ? formatPorcentaje((f.total / total) * 100) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const { filas, total, suma } = await listarMovimientos("ingreso", { anio: ANIO, mes, q });

  return (
    <div className="card">
      <div className="chart-head">Ingresos {ANIO}</div>
      <div className="card-body" style={{ paddingBottom: 0 }}>{filtros}</div>
      <div className="tbl-wrap">
        <table className="tabla-fit">
          <colgroup>
            <col style={{ width: "8%" }} /><col style={{ width: "26%" }} /><col style={{ width: "16%" }} />
            <col style={{ width: "36%" }} /><col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr><th>Fecha</th><th>Tercero</th><th>Detalle</th><th>Observación</th><th className="r">Valor</th></tr>
          </thead>
          <tbody>
            <tr className="fila-total">
              <td colSpan={4} style={{ fontWeight: 800 }}>Total · {formatNumero(total)} movimiento{total === 1 ? "" : "s"}{filas.length < total ? ` (mostrando ${formatNumero(filas.length)})` : ""}</td>
              <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(suma)}</td>
            </tr>
            {filas.length === 0 ? (
              <tr><td colSpan={5} className="empty">Sin movimientos.</td></tr>
            ) : (
              filas.map((m) => (
                <tr key={m.id}>
                  <td className="flag">{fmtFecha(m.fecha)}</td>
                  <td style={{ fontWeight: 600 }} title={m.terceroNombre}>{m.terceroNombre}</td>
                  <td className="flag" title={m.detalle ?? ""}>{m.detalle}</td>
                  <td className="flag" title={m.observacion ?? ""}>{m.observacion}</td>
                  <td className="r num" style={{ fontWeight: 700, color: "var(--ingreso)" }}>{formatCOP(m.valor)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
