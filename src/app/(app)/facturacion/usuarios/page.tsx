// Facturación por usuario de aprobación (FET). KPIs + # documentos por usuario.
import { requirePermiso } from "@/server/auth-context";
import { formatNumero, formatPorcentaje } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import { FiltroAuto } from "../../_components/FiltroAuto";
import { aniosFacturacion, facturacionPorUsuario } from "@/lib/negocio/facturacion";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const AZULES = ["var(--az-1)", "var(--az-2)", "var(--az-3)", "var(--az-4)", "var(--az-5)", "var(--az-6)", "var(--az-7)", "var(--az-8)", "var(--az-otros)"];
const nf = new Intl.NumberFormat("es-CO");

export default async function FacturacionUsuariosPage({ searchParams }: { searchParams: Promise<{ anio?: string; mes?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;
  const anios = await aniosFacturacion();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin facturación cargada. Sube los archivos en <code>/cargar</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const mesNum = Number(sp.mes);
  const mesSel = mesNum >= 1 && mesNum <= 12 ? mesNum : null;

  const { docs, valor, usuarios } = await facturacionPorUsuario(anio, mesSel ? [mesSel] : undefined);
  const maxDocs = Math.max(1, ...usuarios.map((u) => u.docs));

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>Documentos por usuario · {mesSel ? `${MESES[mesSel]} ` : ""}{anio}</div>
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
        <div className="kpi kc"><div className="klabel"># Documentos</div><div className="kval num">{nf.format(docs)}</div></div>
        <div className="kpi kc"><div className="klabel">Valor documentos</div><div className="kval num"><Monto value={valor} /></div></div>
        <div className="kpi kc k-w"><div className="klabel">Usuarios</div><div className="kval num">{usuarios.length}</div></div>
      </div>

      <div className="card">
        <div className="chart-head"># Total documentos por usuario <span className="hact">{formatNumero(docs)} docs</span></div>
        <div className="card-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {usuarios.map((u, idx) => {
              const pct = docs > 0 ? (u.docs / docs) * 100 : 0;
              const nombre = u.usuario.replace(/\./g, " ").toUpperCase();
              return (
                <div key={u.usuario} style={{ display: "grid", gridTemplateColumns: "minmax(0, 180px) 1fr 64px 66px 150px", alignItems: "center", gap: 12 }}>
                  <span className="rank-label" title={nombre} style={{ fontSize: 12.5, fontWeight: 700 }}>{nombre}</span>
                  <div className="rank-bar"><div style={{ width: `${Math.max(2, (u.docs / maxDocs) * 100)}%`, background: AZULES[idx % AZULES.length] }} /></div>
                  <span className="num" style={{ fontSize: 12.5, textAlign: "right", fontWeight: 700 }}>{nf.format(u.docs)}</span>
                  <span className="num flag" style={{ fontSize: 12.5, textAlign: "right" }}>{formatPorcentaje(pct)}</span>
                  <span className="num" style={{ fontSize: 12.5, textAlign: "right" }}><Monto value={u.valor} /></span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
