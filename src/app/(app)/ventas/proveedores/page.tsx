// ==========================================================
// Estado de Proveedores — clasifica cada MARCA con Estado + Motivo (editable),
// con KPIs de venta por estado (riesgo de suministro). Filtro de año/mes.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { formatPorcentaje } from "@/lib/format";
import { aniosConVenta, mesesConVenta, proveedoresConEstado, ventaPorEstadoProveedor } from "@/lib/negocio/ventas";
import { Monto } from "../../_components/Monto";
import { FiltroAuto } from "../../_components/FiltroAuto";
import { guardarEstadoProveedor } from "./actions";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ESTADOS = ["ACTIVO", "CON RESTRICCIÓN", "INACTIVO"];
const MOTIVOS = ["EN OPERACIÓN", "EMBARGO", "SIN OPERACIÓN", "COBRO PREJURIDICO", "ACUERDO DE PAGO"];
const colorEstado = (e: string) => (e === "ACTIVO" ? "var(--ok)" : e === "INACTIVO" ? "var(--bad)" : e === "CON RESTRICCIÓN" ? "var(--w1)" : "var(--muted)");

export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ anio?: string; mes?: string; q?: string }> }) {
  const { usuario } = await requirePermiso("cxp.view");
  const editable = await puede(usuario, "ventas.manage");
  const sp = await searchParams;

  const anios = await aniosConVenta();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin ventas cargadas. Corre <code>npm run db:ventas</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const mesesDisp = await mesesConVenta(anio);
  const mesSel = sp.mes && mesesDisp.includes(Number(sp.mes)) ? Number(sp.mes) : undefined;
  const q = sp.q?.trim().toUpperCase() || undefined;

  const [porEstado, filasTodas] = await Promise.all([
    ventaPorEstadoProveedor(anio, mesSel ? [mesSel] : undefined),
    proveedoresConEstado(anio, mesSel ? [mesSel] : undefined),
  ]);
  const filas = q ? filasTodas.filter((f) => f.marca.toUpperCase().includes(q)) : filasTodas;

  const total = porEstado.reduce((s, e) => s + e.valor, 0);
  const enRiesgo = porEstado.filter((e) => e.estado === "INACTIVO" || e.estado === "CON RESTRICCIÓN").reduce((s, e) => s + e.valor, 0);
  const sinClasificar = porEstado.find((e) => e.estado === "Sin clasificar")?.proveedores ?? 0;
  const periodo = mesSel ? `${MESES[mesSel]} ${anio}` : `${anio}`;

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>Estado de Proveedores · {periodo} · {filasTodas.length} marcas</div>
          <FiltroAuto className="toolbar" role="search">
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">{anios.map((a) => <option key={a} value={a}>{a}</option>)}</select>
            <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
            <select name="mes" defaultValue={mesSel ?? ""} className="select">
              <option value="">Todos</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{MESES[m]}</option>)}
            </select>
            <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Buscar marca…" className="select" style={{ minWidth: 180 }} aria-label="Buscar" />
            {q ? <a href={`/ventas/proveedores?anio=${anio}${mesSel ? `&mes=${mesSel}` : ""}`} className="btn">Limpiar</a> : null}
          </FiltroAuto>
        </div>
      </div>

      {/* KPIs: venta por estado + riesgo */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 12 }}>
        {porEstado.map((e) => (
          <div className="card" key={e.estado}>
            <div className="chart-head" style={{ background: colorEstado(e.estado) }}>{e.estado} <span className="hact">{e.proveedores} marcas</span></div>
            <div className="card-body kpi-body">
              <div className="num kpi-val"><Monto value={e.valor} /></div>
              <div className="ksub" style={{ justifyContent: "center" }}><span className="flag">{formatPorcentaje(total > 0 ? (e.valor / total) * 100 : 0)} del total</span></div>
            </div>
          </div>
        ))}
        <div className="card">
          <div className="chart-head" style={{ background: "var(--bad)" }}>Venta en riesgo</div>
          <div className="card-body kpi-body">
            <div className="num kpi-val"><Monto value={enRiesgo} /></div>
            <div className="ksub" style={{ justifyContent: "center" }}><span className="flag">{formatPorcentaje(total > 0 ? (enRiesgo / total) * 100 : 0)} · inactivos + restringidos</span></div>
          </div>
        </div>
      </div>

      {/* Tabla editable */}
      <div className="card">
        <div className="chart-head">Clasificación por marca <span className="hact">{editable ? "editable" : "solo lectura"}{sinClasificar ? ` · ${sinClasificar} sin clasificar` : ""}</span></div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr><th>Marca (proveedor)</th><th className="r">Venta neta</th><th>Estado</th><th>Motivo</th>{editable ? <th className="r">Acción</th> : null}</tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={editable ? 5 : 4}><div className="empty">Sin marcas{q ? " para la búsqueda" : ""}.</div></td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.marca}>
                    <td style={{ fontWeight: 600 }}>{f.marca}</td>
                    <td className="r num"><Monto value={f.valor} /></td>
                    {editable ? (
                      <>
                        <td colSpan={3} style={{ padding: 0 }}>
                          <form action={guardarEstadoProveedor} className="toolbar" style={{ margin: 0, padding: "4px 8px", gap: 6, alignItems: "center" }}>
                            <input type="hidden" name="marca" value={f.marca} />
                            <select name="estado" defaultValue={ESTADOS.includes(f.estado) ? f.estado : "ACTIVO"} className="select" style={{ minWidth: 150 }}>
                              {ESTADOS.map((x) => <option key={x} value={x}>{x}</option>)}
                            </select>
                            <select name="motivo" defaultValue={f.motivo} className="select" style={{ minWidth: 170 }}>
                              <option value="">—</option>
                              {MOTIVOS.map((x) => <option key={x} value={x}>{x}</option>)}
                            </select>
                            <button type="submit" className="btn primary">Guardar</button>
                          </form>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><span style={{ fontWeight: 700, color: colorEstado(f.estado) }}>{f.estado}</span></td>
                        <td className="flag">{f.motivo || "—"}</td>
                      </>
                    )}
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
