// Facturas anuladas (NAN): valor por motivo y por responsable + KPIs.
import { requirePermiso } from "@/server/auth-context";
import { formatNumero, formatPorcentaje } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import { FiltroAuto } from "../../_components/FiltroAuto";
import { aniosFacturacion, anuladasResumen, type AgrupAnulada } from "@/lib/negocio/facturacion";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const AZULES = ["var(--az-1)", "var(--az-2)", "var(--az-3)", "var(--az-4)", "var(--az-5)", "var(--az-6)", "var(--az-7)", "var(--az-8)", "var(--az-otros)"];
const nf = new Intl.NumberFormat("es-CO");

function ListaBarras({ titulo, sub, items, total }: { titulo: string; sub: string; items: AgrupAnulada[]; total: number }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.valor)));
  return (
    <div className="card">
      <div className="chart-head">{titulo} <span className="hact">{sub}</span></div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {items.length === 0 ? <div className="empty">Sin datos.</div> : items.map((it, idx) => {
          const pct = total > 0 ? (it.valor / total) * 100 : 0;
          return (
            <div key={it.clave} style={{ display: "grid", gridTemplateColumns: "minmax(0, 170px) 1fr auto", alignItems: "center", gap: 10 }}>
              <span className="rank-label" title={it.clave} style={{ fontSize: 12.5, fontWeight: 600 }}>{it.clave}</span>
              <div className="rank-bar"><div style={{ width: `${Math.max(2, (Math.abs(it.valor) / max) * 100)}%`, background: AZULES[idx % AZULES.length] }} /></div>
              <span className="num" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}><Monto value={it.valor} /> <span className="flag">· {nf.format(it.count)} · {formatPorcentaje(pct)}</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function AnuladasPage({ searchParams }: { searchParams: Promise<{ anio?: string; mes?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;
  const anios = await aniosFacturacion();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin datos de anuladas. Sube los archivos en <code>/cargar</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const mesNum = Number(sp.mes);
  const mesSel = mesNum >= 1 && mesNum <= 12 ? mesNum : null;

  const { count, valor, porMotivo, porResponsable } = await anuladasResumen(anio, mesSel ? [mesSel] : undefined);

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>Facturas anuladas · {mesSel ? `${MESES[mesSel]} ` : ""}{anio}</div>
          <FiltroAuto className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">{anios.map((a) => <option key={a} value={a}>{a}</option>)}</select>
            <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
            <select name="mes" defaultValue={mesSel ?? ""} className="select">
              <option value="">Todos</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{MESES[m]}</option>)}
            </select>
          </FiltroAuto>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi kc k-egreso"><div className="klabel"># Facturas anuladas</div><div className="kval num">{nf.format(count)}</div></div>
        <div className="kpi kc k-egreso"><div className="klabel">Valor anulado</div><div className="kval num"><Monto value={valor} /></div></div>
        <div className="kpi kc k-w"><div className="klabel">Motivos</div><div className="kval num">{porMotivo.length}</div></div>
      </div>

      <div className="grid two" style={{ alignItems: "start" }}>
        <ListaBarras titulo="Valor por motivo" sub={`${formatNumero(porMotivo.length)} motivos`} items={porMotivo} total={valor} />
        <ListaBarras titulo="Valor por responsable" sub={`${formatNumero(porResponsable.length)} responsables`} items={porResponsable} total={valor} />
      </div>
    </>
  );
}
