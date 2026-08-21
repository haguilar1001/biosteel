// ==========================================================
// Pendientes por Despacho — lo que se ordenó y el proveedor no ha entregado.
// A diferencia de las otras vistas, esta es una FOTO: el archivo trae lo que
// seguía pendiente el día de la carga, y lo ya despachado desaparece.
//
// El periodo se filtra por FECHA DE ENTREGA pactada (igual que el tablero),
// que es lo que permite ver el atraso: días vencidos = hoy − fecha de entrega.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatNumero, formatFecha } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import { resumenCompras, detallePendientes, corteDePendientes } from "@/lib/negocio/compras";
import { resolverFiltro, type ParamsCompras } from "../_filtro";
import { BarraFiltros } from "../_BarraFiltros";

const LIMITE = 500;

/** Semáforo de atraso: al día, por vencer o vencido. */
function tonoAtraso(dias: number | null): { clase: string; texto: string } {
  if (dias == null) return { clase: "t-blue", texto: "sin fecha" };
  if (dias > 30) return { clase: "t-bad", texto: `${dias} días vencido` };
  if (dias > 0) return { clase: "t-w1", texto: `${dias} días vencido` };
  if (dias === 0) return { clase: "t-w1", texto: "vence hoy" };
  return { clase: "t-ok", texto: `en ${Math.abs(dias)} días` };
}

export default async function PendientesPage({ searchParams }: { searchParams: Promise<ParamsCompras> }) {
  await requirePermiso("compras.view");
  const c = await resolverFiltro(await searchParams);

  if (!c) {
    return (
      <div className="card"><div className="card-body">
        <div className="empty">Sin compras cargadas. Corre <code>npm run db:compras</code>.</div>
      </div></div>
    );
  }

  const hoy = new Date();
  const [kpi, filas, corte] = await Promise.all([
    resumenCompras(c.filtro), detallePendientes(c.filtro, hoy, LIMITE), corteDePendientes(),
  ]);

  const vencidos = filas.filter((r) => (r.diasVencido ?? -1) > 0);
  const valorVencido = vencidos.reduce((s, r) => s + r.valorPendiente, 0);
  const unidades = filas.reduce((s, r) => s + r.cantPendiente, 0);
  const recortado = filas.length === LIMITE;

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div className="eyebrow" style={{ fontSize: 15 }}>Pendientes por Despacho · {c.etiqueta}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              Foto del inventario pendiente{corte ? ` · cargada el ${formatFecha(corte)}` : ""} ·
              el periodo filtra por fecha de entrega pactada
            </div>
          </div>
          <BarraFiltros
            c={c}
            extra={<a href={`/compras/pendientes/export?${c.query}`} className="btn" title="Descargar los pendientes en Excel">⬇️ Excel</a>}
          />
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi kc k-w"><div className="klabel">$ Pendiente por Despacho</div><div className="kval num"><Monto value={kpi.pendiente} /></div></div>
        <div className="kpi kc"><div className="klabel">Cantidad PPD</div><div className="kval num">{formatNumero(kpi.pendienteCant)}</div><div className="ksub flag">{formatNumero(unidades)} unidades</div></div>
        <div className="kpi kc k-bad"><div className="klabel">Vencido</div><div className="kval num"><Monto value={valorVencido} /></div><div className="ksub flag">{formatNumero(vencidos.length)} renglones</div></div>
        <div className="kpi kc k-ok"><div className="klabel">Entradas por Compras</div><div className="kval num"><Monto value={kpi.entradas} /></div></div>
      </div>

      <div className="card">
        <div className="chart-head">
          Detalle · ordenado por fecha de entrega
          <span className="hact">{recortado ? `${LIMITE} renglones · ` : `${formatNumero(filas.length)} renglones · `}<Monto value={filas.reduce((s, r) => s + r.valorPendiente, 0)} /></span>
        </div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr>
                <th>Nro orden</th><th>Proveedor</th><th>Ítem</th><th>Bodega</th>
                <th className="r">Ordenado</th><th className="r">Recibido</th><th className="r">Pendiente</th>
                <th className="r">$ Pendiente</th><th>Entrega</th><th>Atraso</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r, i) => {
                const t = tonoAtraso(r.diasVencido);
                return (
                  <tr key={`${r.nroOrden}-${i}`}>
                    <td style={{ fontWeight: 600 }}>{r.nroOrden}</td>
                    <td>{r.proveedor || "—"}</td>
                    <td style={{ fontSize: 12 }}>{r.itemResumen || "—"}</td>
                    <td className="flag">{r.bodegaCodigo}{r.bodegaDesc ? ` · ${r.bodegaDesc}` : ""}</td>
                    <td className="r num">{formatNumero(r.cantOrden)}</td>
                    <td className="r num flag">{formatNumero(r.cantEntrada)}</td>
                    <td className="r num" style={{ fontWeight: 600 }}>{formatNumero(r.cantPendiente)}</td>
                    <td className="r num"><Monto value={r.valorPendiente} /></td>
                    <td className="num">{r.fechaEntrega ? formatFecha(r.fechaEntrega) : "—"}</td>
                    <td><span className={`tag ${t.clase}`}>{t.texto}</span></td>
                  </tr>
                );
              })}
              {filas.length === 0 ? (
                <tr><td colSpan={10}><div className="empty">Sin pendientes con estos filtros.</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {recortado ? (
          <div className="card-body" style={{ padding: "8px 14px", fontSize: 12, color: "var(--muted)" }}>
            Se muestran los {LIMITE} primeros renglones. Descarga el Excel para verlos todos.
          </div>
        ) : null}
      </div>
    </>
  );
}
