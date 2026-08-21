// ==========================================================
// Informe de Compras — réplica del tablero de Power BI, con las cuatro
// medidas cuadradas contra él (corte 11-ago-2026):
//   Entradas por Compras $43.832.727 · Órdenes $85.066.190 / 20 ODC ·
//   Pendiente $1.417.489 / 1 PPD · Facturado $4.283.621 / 7 FPP
//
// Las cuatro miden momentos distintos de la misma compra —se pide (ODC),
// llega (entrada), queda faltando (pendiente) y se factura (FPP)—, así que
// NO tienen por qué sumar entre sí ni coincidir en el mismo día.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatCOPCorto, formatNumero, formatFecha } from "@/lib/format";
import { Monto } from "../_components/Monto";
import { Donut } from "../_components/charts/Donut";
import { LineasMensuales } from "../_components/charts/LineasMensuales";
import { TopRanking } from "../_components/charts/TopRanking";
import {
  resumenCompras, comprasPorMes, ordenesPorModeloCompra, entradasPorCiudad,
  comprasPorProveedor, ordenesPorEstado, corteDePendientes, filtrosIgnorados,
  MES_CORTO,
} from "@/lib/negocio/compras";
import { resolverFiltro, type ParamsCompras } from "./_filtro";
import { BarraFiltros } from "./_BarraFiltros";

const CATS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)",
  "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];

export default async function ComprasPage({ searchParams }: { searchParams: Promise<ParamsCompras> }) {
  await requirePermiso("compras.view");
  const c = await resolverFiltro(await searchParams);

  if (!c) {
    return (
      <div className="card"><div className="card-body">
        <div className="empty">Sin compras cargadas. Corre <code>npm run db:compras</code> o súbelas desde <a href="/cargar">Cargar archivos</a>.</div>
      </div></div>
    );
  }

  const f = c.filtro;
  const [kpi, meses, modelos, ciudades, tablaProv, estados, corte] = await Promise.all([
    resumenCompras(f), comprasPorMes(f), ordenesPorModeloCompra(f),
    entradasPorCiudad(f), comprasPorProveedor(f), ordenesPorEstado(f), corteDePendientes(),
  ]);

  const ignorados = filtrosIgnorados(f);

  // Entradas vs Pendientes: cuánto de lo comprado ya entró y cuánto sigue
  // faltando. Es el anillo de la derecha del tablero.
  const totalEntPen = kpi.entradas + kpi.pendiente;
  const pctEntradas = totalEntPen > 0 ? (kpi.entradas / totalEntPen) * 100 : 0;

  // Cumplimiento: qué proporción de lo ordenado ya se recibió. Solo se muestra
  // en vistas de mes o año; en un día suelto la orden y su entrada casi nunca
  // caen en la misma fecha y el número sería ruido.
  const mostrarCumplimiento = !f.dia;
  const cumplimiento = kpi.ordenes > 0 ? (kpi.entradas / kpi.ordenes) * 100 : null;

  const { filas: proveedores, entradasSinIdentificar } = tablaProv;
  const totalProv = proveedores.reduce((s, p) => s + p.ordenes, 0);
  const totalEntradasTabla = proveedores.reduce((s, p) => s + p.entradas, 0) + entradasSinIdentificar;

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div className="eyebrow" style={{ fontSize: 15 }}>Informe de Compras · {c.etiqueta}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {f.proveedor ?? "Todos los proveedores"}
              {f.linea ? ` · ${f.linea}` : ""}
              {f.tipoCompra ? ` · ${f.tipoCompra}` : ""}
              {corte ? ` · pendientes al ${formatFecha(corte)}` : ""}
            </div>
          </div>
          <BarraFiltros c={c} />
        </div>
      </div>

      {/* Los cuatro KPI del tablero. El subtítulo lleva el conteo de documentos. */}
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi kc k-ingreso">
          <div className="klabel">📥 Entradas por Compras{kpi.entradasEstimadas ? " *" : ""}</div>
          <div className="kval num"><Monto value={kpi.entradas} /></div>
          <div className="ksub flag">
            {formatNumero(kpi.entradasUnidades)} unidades{kpi.entradasEstimadas ? " · estimado" : ""}
          </div>
        </div>
        <div className="kpi kc">
          <div className="klabel">📄 Órdenes de Compra</div>
          <div className="kval num"><Monto value={kpi.ordenes} /></div>
          <div className="ksub flag">{formatNumero(kpi.ordenesCant)} ODC</div>
        </div>
        <div className="kpi kc k-w">
          <div className="klabel">⏳ Pendiente por Despacho</div>
          <div className="kval num"><Monto value={kpi.pendiente} /></div>
          <div className="ksub flag">{formatNumero(kpi.pendienteCant)} PPD</div>
        </div>
        <div className="kpi kc k-egreso">
          <div className="klabel">🧾 Facturado Proveedor</div>
          <div className="kval num"><Monto value={kpi.facturado} /></div>
          <div className="ksub flag">{formatNumero(kpi.facturadoCant)} FPP</div>
        </div>
      </div>

      {/* Una cifra estimada o un filtro que no aplica cambiarían la lectura
          del KPI sin avisar; mejor decirlo que dejar comparar peras con
          manzanas. */}
      {kpi.entradasEstimadas || ignorados.facturas.length ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--muted)" }}>
            ⚠️ Ojo con estas tarjetas:
            {kpi.entradasEstimadas ? <> <b>Entradas por Compras</b> está atribuida por marca del producto, porque el movimiento de inventario no trae razón social: es una aproximación, no un dato del documento.</> : null}
            {ignorados.facturas.length ? <> <b>Facturado</b> ignora {ignorados.facturas.join(" y ")} (el documento CCP es de cabecera, sin línea de producto).</> : null}
          </div>
        </div>
      ) : null}

      <div className="grid two" style={{ marginBottom: 12, alignItems: "stretch" }}>
        {/* Evolución mensual: lo pedido, lo recibido y lo facturado. */}
        <div className="card">
          <div className="chart-head">
            Compras por Mes · {f.anio}
            <span className="hact">valores en millones COP</span>
          </div>
          <div className="card-body">
            <LineasMensuales
              categorias={MES_CORTO.slice(1)}
              series={[
                { label: "Órdenes de compra", color: "var(--brand)", data: meses.map((m) => m.ordenes) },
                { label: "Entradas por compra", color: "var(--ok)", data: meses.map((m) => m.entradas) },
                { label: "Facturado proveedor", color: "var(--w1)", data: meses.map((m) => m.facturado), dash: true },
              ]}
            />
          </div>
        </div>

        {/* Entradas vs Pendientes — el anillo de la derecha del tablero. */}
        <div className="card">
          <div className="chart-head">
            Entradas vs Pendientes
            <span className="hact">{pctEntradas.toFixed(1).replace(".", ",")} % recibido</span>
          </div>
          <div className="card-body" style={{ display: "flex", justifyContent: "center" }}>
            <Donut
              size={260}
              data={[
                { label: "Entradas por compra", valor: kpi.entradas, color: "var(--ok)" },
                { label: "Pendiente por despacho", valor: kpi.pendiente, color: "var(--w1)" },
              ]}
              centro={{
                valor: formatCOP(totalEntPen),
                valorCorto: formatCOPCorto(totalEntPen),
                etiqueta: "entradas + pendiente",
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 12, alignItems: "stretch" }}>
        {/* Órdenes por modelo de compra (viene del catálogo de bodegas). */}
        <div className="card">
          <div className="chart-head">
            Órdenes de Compra x Modelo de Compra
            <span className="hact">total <Monto value={kpi.ordenes} /></span>
          </div>
          <div className="card-body" style={{ display: "flex", justifyContent: "center" }}>
            {modelos.length ? (
              <Donut
                size={260}
                data={modelos.map((m, i) => ({
                  label: m.label, valor: m.valor,
                  color: m.label === "Sin modelo" ? "var(--muted)" : CATS[i % CATS.length]!,
                }))}
                centro={{ valor: formatNumero(kpi.ordenesCant), etiqueta: "órdenes" }}
              />
            ) : <div className="empty">Sin órdenes en el periodo.</div>}
          </div>
        </div>

        {/* Entradas por ciudad de la bodega que recibió. */}
        <div className="card">
          <div className="chart-head">
            Entradas por Compra x Ciudad
            <span className="hact">total <Monto value={kpi.entradas} /></span>
          </div>
          <div className="card-body">
            {ciudades.length ? (
              <TopRanking
                titulo=""
                items={ciudades.map((x) => ({ label: x.label, valor: x.valor }))}
                color="var(--ok)"
              />
            ) : <div className="empty">Sin entradas por compra en el periodo.</div>}
          </div>
        </div>
      </div>

      {/* Estado de las órdenes + cumplimiento. */}
      <div className="grid two" style={{ marginBottom: 12, alignItems: "stretch" }}>
        <div className="card">
          <div className="chart-head">Órdenes por Estado</div>
          <div className="tbl-wrap">
            <table className="tabla-fit">
              <thead><tr><th>Estado</th><th className="r">Valor</th><th className="r">% del total</th></tr></thead>
              <tbody>
                {estados.map((e) => (
                  <tr key={e.label}>
                    <td style={{ fontWeight: 600 }}>{e.label}</td>
                    <td className="r num"><Monto value={e.valor} /></td>
                    <td className="r num flag">
                      {kpi.ordenes > 0 ? `${((e.valor / kpi.ordenes) * 100).toFixed(1).replace(".", ",")} %` : "—"}
                    </td>
                  </tr>
                ))}
                {estados.length === 0 ? <tr><td colSpan={3}><div className="empty">Sin órdenes en el periodo.</div></td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="chart-head">Lectura del periodo</div>
          <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
            <p style={{ marginTop: 0 }}>
              Se ordenaron <b><Monto value={kpi.ordenes} /></b> en {formatNumero(kpi.ordenesCant)} órdenes
              y entraron <b><Monto value={kpi.entradas} /></b> en material.
              {mostrarCumplimiento && cumplimiento != null ? (
                <> Eso es un <b>{cumplimiento.toFixed(1).replace(".", ",")} %</b> de cumplimiento en el periodo.</>
              ) : null}
            </p>
            <p>
              Quedan <b><Monto value={kpi.pendiente} /></b> sin despachar en {formatNumero(kpi.pendienteCant)} órdenes,
              y el proveedor facturó <b><Monto value={kpi.facturado} /></b> en {formatNumero(kpi.facturadoCant)} documentos.
            </p>
            <p style={{ color: "var(--muted)", fontSize: 12 }}>
              Las cuatro cifras miden momentos distintos de la misma compra (se pide → llega →
              queda faltando → se factura), así que no cuadran entre sí en un mismo día: una orden
              de hoy puede entrar la otra semana y facturarse al mes siguiente.
            </p>
          </div>
        </div>
      </div>

      {/* Tabla por proveedor — la del tablero, con facturado añadido. */}
      <div className="card">
        <div className="chart-head">
          Compras por Proveedor
          <span className="hact">{formatNumero(proveedores.length)} proveedores</span>
        </div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr>
                <th>Razón social proveedor</th>
                <th>Tipo de compra</th>
                <th className="r">$ Órdenes de Compra</th>
                <th className="r">ODC</th>
                <th className="r" title="Atribuido al proveedor a través de la marca del producto: el movimiento de inventario no trae razón social.">$ Entradas por Compras *</th>
                <th className="r">$ Pendiente por Despacho</th>
                <th className="r">$ Facturado Proveedor</th>
                <th className="r">% del total</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.proveedor}>
                  <td style={{ fontWeight: 600 }}>{p.proveedor || "—"}</td>
                  <td className="flag">{p.tipoCompra}</td>
                  <td className="r num">{p.ordenes ? <Monto value={p.ordenes} /> : "—"}</td>
                  <td className="r num flag">{p.ordenesCant || "—"}</td>
                  <td className="r num" style={{ color: p.entradas ? "var(--ok)" : undefined }}>
                    {p.entradas ? <Monto value={p.entradas} /> : "—"}
                  </td>
                  <td className="r num" style={{ color: p.pendiente ? "var(--w1)" : undefined, fontWeight: p.pendiente ? 600 : undefined }}>
                    {p.pendiente ? <Monto value={p.pendiente} /> : "—"}
                  </td>
                  <td className="r num">{p.facturado ? <Monto value={p.facturado} /> : "—"}</td>
                  <td className="r num flag">
                    {totalProv > 0 && p.ordenes ? `${((p.ordenes / totalProv) * 100).toFixed(1).replace(".", ",")} %` : "—"}
                  </td>
                </tr>
              ))}
              {proveedores.length === 0 ? (
                <tr><td colSpan={8}><div className="empty">Sin movimiento de compras en el periodo.</div></td></tr>
              ) : (
                <>
                  {/* Entradas cuya marca no aparece en ninguna orden. Va como
                      fila propia para que la columna sume el KPI y no se
                      pierda plata por el camino. */}
                  {entradasSinIdentificar > 0 && (
                    <tr>
                      <td style={{ fontWeight: 600, color: "var(--muted)", fontStyle: "italic" }}>Sin identificar</td>
                      <td className="flag">—</td>
                      <td className="r num">—</td>
                      <td className="r num flag">—</td>
                      <td className="r num" style={{ color: "var(--muted)" }}><Monto value={entradasSinIdentificar} /></td>
                      <td className="r num">—</td>
                      <td className="r num">—</td>
                      <td className="r num">—</td>
                    </tr>
                  )}
                  <tr className="fila-total">
                    <td style={{ fontWeight: 800 }}>Total</td>
                    <td />
                    <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.ordenes} /></td>
                    <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(kpi.ordenesCant)}</td>
                    <td className="r num" style={{ fontWeight: 800 }}><Monto value={totalEntradasTabla} /></td>
                    <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.pendiente} /></td>
                    <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.facturado} /></td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-body" style={{ padding: "8px 14px", fontSize: 12, color: "var(--muted)" }}>
          <b>*</b> Las entradas se atribuyen al proveedor por la <b>marca del producto</b>: el movimiento
          de inventario no trae razón social. Cuando una marca se le compra a varios proveedores, la
          entrada se le carga al que más ha ordenado esa marca, así que esta columna es una
          aproximación — las otras tres salen directo del documento.
          {entradasSinIdentificar > 0 ? " Lo que no cruzó con ninguna orden va en \"Sin identificar\"." : ""}
        </div>
      </div>
    </>
  );
}
