// ==========================================================
// Informe de Pedidos — la página PEDIDOS del tablero de Power BI: qué material
// pidió el bloque quirúrgico, por cuánto, para cuántos pacientes y en qué
// estado va cada pedido.
//
// La medida principal ($ PEDIDOS) es el COSTO promedio del material pedido,
// no la venta; la razón y la verificación contra el tablero están en la
// cabecera de lib/negocio/pedidos.ts. La venta y la utilidad van al lado,
// porque el mismo pedido se lee de las dos maneras según quién pregunte:
// Compras mira el costo, Comercial mira la venta.
//
// Dos cortes NO coinciden al peso con el .pbix, y es a propósito:
//   · Ciudad — aquí sale de la "Desc. ciudad" del propio documento; el
//     tablero la toma del catálogo de bodegas, y las bodegas que su catálogo
//     no tiene le quedan en "(En blanco)". El de la app está más completo.
//   · Modelo de compra — misma historia: sale del catálogo de bodegas de la
//     app (InvBodega), que ya difiere del .pbix en varias bodegas.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatCOPCorto, formatNumero, formatPorcentaje } from "@/lib/format";
import { Monto } from "../_components/Monto";
import { Donut } from "../_components/charts/Donut";
import { LineasMensuales } from "../_components/charts/LineasMensuales";
import { TopRanking } from "../_components/charts/TopRanking";
import {
  resumenPedidos, costoPorLinea, pedidosPorMarca, pedidosPorCiudad,
  pedidosPorAnatomia, pedidosPorModeloCompra, pedidosPorMes,
  SIN_MODELO, MES_CORTO,
} from "@/lib/negocio/pedidos";
import { resolverFiltro, resumenFiltros, type ParamsPedidos } from "./_filtro";
import { BarraFiltros } from "./_BarraFiltros";

const CATS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)",
  "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];

/** Color del estado del pedido: cumplido es bueno, en elaboración es aviso. */
function colorEstado(estado: string): string {
  const e = estado.toLowerCase();
  if (e.startsWith("cumplido")) return "var(--ok)";
  if (e.startsWith("comprometido")) return "var(--brand)";
  if (e.startsWith("aprobado")) return "var(--az-3)";
  return "var(--w1)";
}

export default async function PedidosPage({ searchParams }: { searchParams: Promise<ParamsPedidos> }) {
  await requirePermiso("pedidos.view");
  const c = await resolverFiltro(await searchParams);

  if (!c) {
    return (
      <div className="card"><div className="card-body">
        <div className="empty">
          Sin pedidos cargados. Súbelos desde <a href="/cargar">Cargar archivos</a> o
          corre <code>npm run db:pedidos</code>.
        </div>
      </div></div>
    );
  }

  const f = c.filtro;
  const [kpi, lineas, marcas, ciudades, anatomias, modelos, meses] = await Promise.all([
    resumenPedidos(f), costoPorLinea(f), pedidosPorMarca(f), pedidosPorCiudad(f),
    pedidosPorAnatomia(f), pedidosPorModeloCompra(f), pedidosPorMes(f),
  ]);

  const margen = kpi.venta > 0 ? (kpi.utilidad / kpi.venta) * 100 : 0;
  const costoUnitario = kpi.cantidad > 0 ? kpi.costo / kpi.cantidad : 0;
  const totalLineas = lineas.reduce((s, l) => s + l.costoTotal, 0);

  // La gráfica se corta en el último mes con datos: dibujar los meses que aún
  // no han pasado deja medio año plano en cero, y la curva suave llega a bajar
  // del eje buscando ese cero, que se lee como si hubiera pedidos negativos.
  const ultimoConDato = meses.reduce((max, m) => (m.costo || m.venta ? m.mes : max), 1);
  const mesesVisibles = meses.slice(0, ultimoConDato);

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div className="eyebrow" style={{ fontSize: 15 }}>Informe de Pedidos · {c.etiqueta}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{resumenFiltros(c)}</div>
          </div>
          <BarraFiltros c={c} />
        </div>
      </div>

      {/* Los KPI del tablero: $ pedidos (costo), nro de pedidos y pacientes. */}
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi kc k-egreso">
          <div className="klabel">📦 $ Pedidos (costo)</div>
          <div className="kval num"><Monto value={kpi.costo} /></div>
          <div className="ksub flag">{formatNumero(kpi.cantidad)} unidades · {formatCOP(costoUnitario)} c/u</div>
        </div>
        <div className="kpi kc">
          <div className="klabel">📝 Pedidos</div>
          <div className="kval num">{formatNumero(kpi.documentos)}</div>
          <div className="ksub flag">{formatNumero(kpi.referencias)} referencias distintas</div>
        </div>
        <div className="kpi kc k-w">
          <div className="klabel">🧑‍⚕️ Pacientes</div>
          <div className="kval num">{formatNumero(kpi.pacientes)}</div>
          <div className="ksub flag">
            {kpi.pacientes > 0 ? `${(kpi.documentos / kpi.pacientes).toFixed(1).replace(".", ",")} pedidos por paciente` : "—"}
          </div>
        </div>
        <div className="kpi kc k-ingreso">
          <div className="klabel">💹 Venta del material pedido</div>
          <div className="kval num"><Monto value={kpi.venta} /></div>
          <div className="ksub flag">utilidad <Monto value={kpi.utilidad} /> · {formatPorcentaje(margen)}</div>
        </div>
      </div>

      {/* Estado del movimiento: los tres suman el $ pedidos. */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">
          Estado de los pedidos
          <span className="hact">suman el $ pedidos del periodo</span>
        </div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr>
                <th>Estado del movimiento</th>
                <th className="r">$ Pedidos (costo)</th>
                <th className="r">% del total</th>
                <th>Reparto</th>
                <th className="r">Pedidos</th>
                <th className="r">Venta</th>
              </tr>
            </thead>
            <tbody>
              {kpi.porEstado.map((e) => {
                const pct = kpi.costo > 0 ? (e.costo / kpi.costo) * 100 : 0;
                return (
                  <tr key={e.estado}>
                    <td style={{ fontWeight: 600 }}>
                      <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: colorEstado(e.estado), marginRight: 8 }} />
                      {e.estado}
                    </td>
                    <td className="r num"><Monto value={e.costo} /></td>
                    <td className="r num" style={{ fontWeight: 700 }}>{formatPorcentaje(pct)}</td>
                    <td style={{ minWidth: 140 }}>
                      <div className="rank-bar"><div style={{ width: `${Math.max(pct, 0)}%`, background: colorEstado(e.estado) }} /></div>
                    </td>
                    <td className="r num flag">{formatNumero(e.documentos)}</td>
                    <td className="r num flag"><Monto value={e.venta} /></td>
                  </tr>
                );
              })}
              {kpi.porEstado.length === 0 ? (
                <tr><td colSpan={6}><div className="empty">Sin pedidos en el periodo.</div></td></tr>
              ) : (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.costo} /></td>
                  <td className="r num" style={{ fontWeight: 800 }}>100,0 %</td>
                  <td />
                  <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(kpi.documentos)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.venta} /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 12, alignItems: "stretch" }}>
        {/* Evolución mensual del año: costo pedido vs venta. */}
        <div className="card">
          <div className="chart-head">
            Pedidos por Mes · {f.anio}
            <span className="hact">
              {ultimoConDato < 12 ? `Ene–${MES_CORTO[ultimoConDato]} · ` : ""}valores en millones COP
            </span>
          </div>
          <div className="card-body">
            <LineasMensuales
              categorias={MES_CORTO.slice(1, ultimoConDato + 1)}
              series={[
                { label: "$ Pedidos (costo)", color: "var(--brand)", data: mesesVisibles.map((m) => m.costo) },
                { label: "Venta del material", color: "var(--ok)", data: mesesVisibles.map((m) => m.venta), dash: true },
              ]}
            />
          </div>
        </div>

        {/* Modelo de compra: de dónde sale el material que se pidió. */}
        <div className="card">
          <div className="chart-head">
            $ Pedidos x Modelo de Compra
            <span className="hact">del catálogo de bodegas</span>
          </div>
          <div className="card-body" style={{ display: "flex", justifyContent: "center" }}>
            {modelos.length ? (
              <Donut
                size={260}
                data={modelos.map((m, i) => ({
                  label: m.label, valor: m.costo,
                  color: m.label === SIN_MODELO ? "var(--muted)" : CATS[i % CATS.length]!,
                }))}
                centro={{
                  valor: formatCOP(kpi.costo),
                  valorCorto: formatCOPCorto(kpi.costo),
                  etiqueta: "$ pedidos",
                }}
              />
            ) : <div className="empty">Sin pedidos en el periodo.</div>}
          </div>
          <div className="card-body" style={{ padding: "0 14px 10px", fontSize: 12, color: "var(--muted)" }}>
            El material de <b>aprovechamiento</b> aparece en $0: tiene unidades pero no
            tiene valor en libros. No es un error de carga.
          </div>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 12, alignItems: "stretch" }}>
        <div className="card">
          <div className="chart-head">$ Pedidos por Ciudad</div>
          <div className="card-body">
            {ciudades.length ? (
              <TopRanking titulo="" items={ciudades.map((x) => ({ label: x.label, valor: x.costo, sub: `${formatNumero(x.documentos)} pedidos` }))} color="var(--brand)" />
            ) : <div className="empty">Sin pedidos en el periodo.</div>}
          </div>
        </div>
        <div className="card">
          <div className="chart-head">$ Pedidos por Anatomía</div>
          <div className="card-body">
            {anatomias.length ? (
              <TopRanking titulo="" items={anatomias.map((x) => ({ label: x.label, valor: x.costo, sub: `${formatNumero(x.cantidad)} und` }))} color="var(--az-3)" />
            ) : <div className="empty">Sin pedidos en el periodo.</div>}
          </div>
        </div>
      </div>

      {/* Costo promedio por línea: la tabla de la izquierda del tablero. */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">
          Costo Promedio por Línea
          <span className="hact">clic en las columnas para ordenar</span>
        </div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr>
                <th>Línea</th>
                <th className="r">Costo prom. total</th>
                <th className="r">Costo unitario</th>
                <th className="r">Cant. pedida</th>
                <th className="r">% del total</th>
                <th className="r">Venta</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.linea}>
                  <td style={{ fontWeight: 600 }}>{l.linea}</td>
                  <td className="r num"><Monto value={l.costoTotal} /></td>
                  <td className="r num">{l.costoUnitario ? <Monto value={l.costoUnitario} /> : "—"}</td>
                  <td className="r num flag">{formatNumero(l.cantidad)}</td>
                  <td className="r num flag">
                    {totalLineas > 0 ? formatPorcentaje((l.costoTotal / totalLineas) * 100) : "—"}
                  </td>
                  <td className="r num flag"><Monto value={l.venta} /></td>
                </tr>
              ))}
              {lineas.length === 0 ? (
                <tr><td colSpan={6}><div className="empty">Sin pedidos en el periodo.</div></td></tr>
              ) : (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={totalLineas} /></td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={costoUnitario} /></td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(kpi.cantidad)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>100,0 %</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.venta} /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-body" style={{ padding: "8px 14px", fontSize: 12, color: "var(--muted)" }}>
          El <b>costo unitario</b> se promedia solo sobre los renglones que tienen costo. Si se
          promediara sobre todo, el material de aprovechamiento —costo 0 por definición— abarataría
          la línea sin que nada hubiera cambiado de precio.
        </div>
      </div>

      {/* Pedidos por proveedor (MARCA), como en el tablero. */}
      <div className="card">
        <div className="chart-head">
          Pedidos por Proveedor (marca)
          <span className="hact">{formatNumero(marcas.length)} marcas · clic en las columnas para ordenar</span>
        </div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr>
                <th>Marca</th>
                <th className="r">$ Pedidos (costo)</th>
                <th className="r">% del total</th>
                <th>Reparto</th>
                <th className="r">Cant. pedida</th>
                <th className="r">Pedidos</th>
                <th className="r">Venta</th>
              </tr>
            </thead>
            <tbody>
              {marcas.map((m) => {
                const pct = kpi.costo > 0 ? (m.costo / kpi.costo) * 100 : 0;
                return (
                  <tr key={m.label}>
                    <td style={{ fontWeight: 600 }}>{m.label}</td>
                    <td className="r num"><Monto value={m.costo} /></td>
                    <td className="r num" style={{ fontWeight: 700 }}>{formatPorcentaje(pct)}</td>
                    <td style={{ minWidth: 140 }}>
                      <div className="rank-bar"><div style={{ width: `${Math.max(pct, 0)}%`, background: "var(--az-2)" }} /></div>
                    </td>
                    <td className="r num flag">{formatNumero(m.cantidad)}</td>
                    <td className="r num flag">{formatNumero(m.documentos)}</td>
                    <td className="r num flag"><Monto value={m.venta} /></td>
                  </tr>
                );
              })}
              {marcas.length === 0 ? (
                <tr><td colSpan={7}><div className="empty">Sin pedidos en el periodo.</div></td></tr>
              ) : (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.costo} /></td>
                  <td className="r num" style={{ fontWeight: 800 }}>100,0 %</td>
                  <td />
                  <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(kpi.cantidad)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(kpi.documentos)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.venta} /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
