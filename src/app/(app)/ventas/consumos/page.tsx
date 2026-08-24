// ==========================================================
// Informe de Consumos — indicadores de venta neta, costo, utilidad y
// % Utilidad del período, y ese mismo % desglosado por proveedor (MARCA).
// Filtros de año y mes (auto-envío).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatPorcentaje, formatNumero } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import {
  aniosConVenta, mesesConVenta, ipsConVenta, ciudadesDeIps,
  marcasFiltradas, ipsPorMarcaFiltrado, itemsPorMarcaFiltrado,
  listasConVenta, utilidadPorLista, SIN_LISTA, type FiltroConsumo,
} from "@/lib/negocio/ventas";
import { FiltroAuto } from "../../_components/FiltroAuto";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const margen = (venta: number, costo: number) => (venta > 0 ? ((venta - costo) / venta) * 100 : 0);

// Nombre de cada lista de precios por su código SIESA. Se completa a mano
// mientras los datos cargados tengan el código; al re-importar ventas con la
// columna "Desc. lista de precios", `lista` ya trae el nombre y esto no aplica.
const LISTA_NOMBRES: Record<string, string> = {};
const nombreLista = (codigo: string) => LISTA_NOMBRES[codigo] ?? codigo;

type OrdenCol = "marca" | "venta" | "costo" | "utilidad" | "margen";

export default async function ConsumosPage({ searchParams }: { searchParams: Promise<{ anio?: string; mes?: string; orden?: string; dir?: string; vista?: string; ips?: string; ciudad?: string; lista?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  const anios = await aniosConVenta();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin ventas cargadas. Corre <code>npm run db:ventas</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const mesesDisp = await mesesConVenta(anio);
  const mesSel = sp.mes && mesesDisp.includes(Number(sp.mes)) ? Number(sp.mes) : undefined;

  const meses = mesSel ? [mesSel] : undefined;
  // Opciones del filtro: todas las IPS del período (sin filtrar), para que el
  // selector no se vacíe a sí mismo al escoger una.
  const opcionesIps = await ipsConVenta(anio, meses);
  const ciudades = ciudadesDeIps(opcionesIps);
  const ipsSel = sp.ips && opcionesIps.some((o) => o.ips === sp.ips) ? sp.ips : undefined;
  const ciudadSel = !ipsSel && sp.ciudad && ciudades.some((c) => c.ciudad === sp.ciudad) ? sp.ciudad : undefined;
  // Listas de precios del año: se ofrecen sin filtrar (igual que las IPS) para
  // que el selector no se vacíe a sí mismo al escoger una.
  const listasDisp = await listasConVenta(anio);
  const listaSel = sp.lista && (listasDisp.includes(sp.lista) || sp.lista === SIN_LISTA) ? sp.lista : undefined;
  const filtro: FiltroConsumo = { anio, meses, ips: ipsSel, ciudad: ciudadSel, lista: listaSel };

  const [marcasBase, ipsMap, itemsMap, porLista] = await Promise.all([
    marcasFiltradas(filtro, opcionesIps),
    ipsPorMarcaFiltrado(filtro, opcionesIps),
    itemsPorMarcaFiltrado(filtro, opcionesIps),
    // El desglose por lista ignora el propio filtro de lista: si no, al elegir
    // una quedaría una sola fila y no se podrían comparar entre sí.
    utilidadPorLista({ ...filtro, lista: undefined }, opcionesIps),
  ]);
  const ventaListas = porLista.reduce((a, l) => a + l.valor, 0);
  const hayListas = porLista.some((l) => l.lista !== SIN_LISTA);
  const marcas = marcasBase.map((m) => ({ ...m, ips: ipsMap.get(m.marca) ?? [] }));
  const venta = marcas.reduce((s, m) => s + m.valor, 0);
  const costo = marcas.reduce((s, m) => s + m.costo, 0);
  const sinCiudad = opcionesIps.filter((o) => !o.ciudad);
  const utilidad = venta - costo;
  const maxVenta = marcas.length ? Math.max(...marcas.map((m) => m.valor)) : 1;
  const periodo = mesSel ? `${MESES[mesSel]} ${anio}` : `${anio}`;
  const GRID = "minmax(160px, 2fr) 150px 150px 150px 90px 90px";
  const GRID_ITEM = "minmax(200px, 3fr) 80px 120px 130px 130px 130px 90px";

  // Orden de proveedores por columna (clic en el encabezado). Por defecto venta desc.
  const ORDENES: OrdenCol[] = ["marca", "venta", "costo", "utilidad", "margen"];
  const orden: OrdenCol = ORDENES.includes(sp.orden as OrdenCol) ? (sp.orden as OrdenCol) : "venta";
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const clave = (m: { marca: string; valor: number; costo: number }): number | string =>
    orden === "marca" ? m.marca
      : orden === "venta" ? m.valor
      : orden === "costo" ? m.costo
      : orden === "utilidad" ? m.valor - m.costo
      : margen(m.valor, m.costo);
  marcas.sort((a, b) => {
    const va = clave(a), vb = clave(b);
    const c = typeof va === "string" ? va.localeCompare(vb as string, "es") : (va as number) - (vb as number);
    return dir === "asc" ? c : -c;
  });
  // Vista: desglose por IPS o por Ítem (toggle al nivel de los filtros). Por defecto Ítem.
  const vista: "ips" | "item" = sp.vista === "ips" ? "ips" : "item";
  const filtroQS = `${ipsSel ? `&ips=${encodeURIComponent(ipsSel)}` : ""}${ciudadSel ? `&ciudad=${encodeURIComponent(ciudadSel)}` : ""}`;
  const base = `/ventas/consumos?anio=${anio}${mesSel ? `&mes=${mesSel}` : ""}${filtroQS}`;
  const ordenBase = `${base}&vista=${vista}`;
  const linkVista = (v: "ips" | "item") => `${base}&orden=${orden}&dir=${dir}&vista=${v}`;
  const thOrden = (key: OrdenCol, label: string, defDir: "asc" | "desc" = "desc") => {
    const activo = orden === key;
    const nuevaDir = activo ? (dir === "asc" ? "desc" : "asc") : defDir;
    return (
      <a href={`${ordenBase}&orden=${key}&dir=${nuevaDir}`} title="Ordenar" style={{ color: "inherit", textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
        {label}{activo ? (dir === "asc" ? " ▲" : " ▼") : ""}
      </a>
    );
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 15 }}>Informe de Consumos · {periodo} · {marcas.length} proveedores</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {ipsSel ? <>Solo <b>{ipsSel}</b></>
                : ciudadSel ? <>Solo <b>{ciudadSel}</b> · {ciudades.find((c) => c.ciudad === ciudadSel)?.ips ?? 0} IPS</>
                : <>Todas las IPS</>}
            </div>
          </div>
          <FiltroAuto className="toolbar">
            {/* Preserva vista/orden al cambiar año o mes. */}
            <input type="hidden" name="vista" value={vista} />
            <input type="hidden" name="orden" value={orden} />
            <input type="hidden" name="dir" value={dir} />
            <span role="group" aria-label="Ver por" style={{ display: "inline-flex", gap: 4, alignSelf: "center" }}>
              <a href={linkVista("item")} className={`btn ${vista === "item" ? "primary" : ""}`}>Por Ítem</a>
              <a href={linkVista("ips")} className={`btn ${vista === "ips" ? "primary" : ""}`}>Por IPS</a>
            </span>
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
            <select name="mes" defaultValue={mesSel ?? ""} className="select">
              <option value="">Todos los meses</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES[m]}</option>
              ))}
            </select>
            {/* Lista de precios: es la tarifa aplicada al renglón, y lo que
                permite ver qué tarifa deja el ítem en pérdida. Solo aparece
                cuando hay datos con lista cargada. */}
            {hayListas ? (
              <>
                <label className="flag" style={{ alignSelf: "center" }}>Lista:</label>
                <select name="lista" defaultValue={listaSel ?? ""} className="select" style={{ maxWidth: 260 }}>
                  <option value="">Todas</option>
                  {listasDisp.map((l) => <option key={l} value={l}>{nombreLista(l)}</option>)}
                  <option value={SIN_LISTA}>{SIN_LISTA}</option>
                </select>
              </>
            ) : null}
            <label className="flag" style={{ alignSelf: "center" }}>Ciudad:</label>
            <select name="ciudad" defaultValue={ciudadSel ?? ""} className="select">
              <option value="">Todas</option>
              {ciudades.map((c) => <option key={c.ciudad} value={c.ciudad}>{c.ciudad} ({c.ips} IPS)</option>)}
            </select>
            <label className="flag" style={{ alignSelf: "center" }}>IPS:</label>
            <select name="ips" defaultValue={ipsSel ?? ""} className="select" style={{ maxWidth: 300 }}>
              <option value="">Todas</option>
              {ciudades.map((c) => (
                <optgroup key={c.ciudad} label={c.ciudad}>
                  {opcionesIps.filter((o) => o.ciudad === c.ciudad).map((o) => <option key={o.ips} value={o.ips}>{o.ips}</option>)}
                </optgroup>
              ))}
              {sinCiudad.length > 0 && (
                <optgroup label="Sin ciudad en Terceros">
                  {sinCiudad.map((o) => <option key={o.ips} value={o.ips}>{o.ips}</option>)}
                </optgroup>
              )}
            </select>
            {(mesSel || ipsSel || ciudadSel || listaSel)
              ? <a href={`/ventas/consumos?anio=${anio}&orden=${orden}&dir=${dir}&vista=${vista}`} className="btn">Limpiar filtros</a>
              : null}
          </FiltroAuto>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 12 }}>
        <div className="card">
          <div className="chart-head">Venta Neta</div>
          <div className="card-body kpi-body"><div className="num kpi-val"><Monto value={venta} /></div></div>
        </div>
        <div className="card">
          <div className="chart-head">Costo</div>
          <div className="card-body kpi-body"><div className="num kpi-val"><Monto value={costo} /></div></div>
        </div>
        <div className="card">
          <div className="chart-head">Utilidad Bruta</div>
          <div className="card-body kpi-body"><div className="num kpi-val"><Monto value={utilidad} /></div></div>
        </div>
        <div className="card">
          <div className="chart-head">% Utilidad</div>
          <div className="card-body kpi-body"><div className="num kpi-val">{formatPorcentaje(margen(venta, costo))}</div></div>
        </div>
      </div>

      {/* % Utilidad por proveedor (MARCA), desplegable por IPS */}
      <div className="card">
        <div className="chart-head">Utilidad por Proveedor <span className="hact">{periodo} · {vista === "item" ? "por ítem" : "por IPS"} · clic en un proveedor para desplegar · clic en las columnas para ordenar</span></div>
        <div style={{ overflowX: "auto" }}>
          {/* Encabezado */}
          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center", padding: "8px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            <span>{thOrden("marca", "Proveedor (marca)", "asc")}</span>
            <span style={{ textAlign: "right" }}>{thOrden("venta", "Venta neta")}</span>
            <span style={{ textAlign: "right" }}>{thOrden("costo", "Costo")}</span>
            <span style={{ textAlign: "right" }}>{thOrden("utilidad", "Utilidad")}</span>
            <span style={{ textAlign: "right" }}>{thOrden("margen", "% Utilidad")}</span>
            <span />
          </div>
          {marcas.length === 0 ? (
            <div className="empty">Sin datos por proveedor{mesSel ? ` en ${MESES[mesSel]}` : ""}.</div>
          ) : (
            marcas.map((m) => {
              const pct = margen(m.valor, m.costo);
              return (
                <details key={m.marca} className="cons-det">
                  <summary>
                    <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center", padding: "9px 12px" }}>
                      <span style={{ fontWeight: 600 }}><span className="cons-chev">▸</span> {m.marca} <span className="flag">({vista === "ips" ? `${m.ips.length} IPS` : `${itemsMap.get(m.marca)?.length ?? 0} ítems`})</span></span>
                      <span className="num" style={{ textAlign: "right" }}><Monto value={m.valor} /></span>
                      <span className="num flag" style={{ textAlign: "right" }}><Monto value={m.costo} /></span>
                      <span className="num" style={{ textAlign: "right" }}><Monto value={m.valor - m.costo} /></span>
                      <span className="num" style={{ textAlign: "right", fontWeight: 700, color: pct < 0 ? "var(--bad)" : undefined }}>{formatPorcentaje(pct)}</span>
                      <span><div className="rank-bar"><div style={{ width: `${Math.max(2, (m.valor / maxVenta) * 100)}%`, background: "var(--az-2)" }} /></div></span>
                    </div>
                  </summary>
                  {vista === "ips" ? (
                    <div style={{ background: "var(--surface-2, #f6f8fc)", paddingBottom: 4 }}>
                      {m.ips.map((x) => {
                        const p = margen(x.valor, x.costo);
                        return (
                          <div key={x.ips} style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center", padding: "5px 12px", fontSize: 12.5 }}>
                            <span style={{ paddingLeft: 26 }}>{x.ips}</span>
                            <span className="num" style={{ textAlign: "right" }}><Monto value={x.valor} /></span>
                            <span className="num flag" style={{ textAlign: "right" }}><Monto value={x.costo} /></span>
                            <span className="num" style={{ textAlign: "right" }}><Monto value={x.valor - x.costo} /></span>
                            <span className="num" style={{ textAlign: "right", fontWeight: 600, color: p < 0 ? "var(--bad)" : undefined }}>{formatPorcentaje(p)}</span>
                            <span />
                          </div>
                        );
                      })}
                    </div>
                  ) : (itemsMap.get(m.marca)?.length ?? 0) > 0 ? (
                    <div style={{ background: "var(--surface-2, #f6f8fc)", padding: "2px 12px 12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: GRID_ITEM, gap: 8, padding: "6px 0 4px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--muted)" }}>
                        <span>Descripción</span>
                        <span style={{ textAlign: "right" }}>Cantidad</span>
                        <span style={{ textAlign: "right" }}>Costo unit.</span>
                        <span style={{ textAlign: "right" }}>Costo total</span>
                        <span style={{ textAlign: "right" }}>Venta neta</span>
                        <span style={{ textAlign: "right" }}>Utilidad</span>
                        <span style={{ textAlign: "right" }}>% Utilidad</span>
                      </div>
                      {itemsMap.get(m.marca)!.map((it, k) => {
                        const pIt = margen(it.valor, it.costo);
                        return (
                          <div key={`${it.referencia}-${k}`} style={{ display: "grid", gridTemplateColumns: GRID_ITEM, gap: 8, alignItems: "start", padding: "5px 0", fontSize: 12, borderTop: "1px solid var(--line)" }}>
                            <span style={{ lineHeight: 1.3 }}><span className="flag" style={{ fontWeight: 700 }}>{it.referencia}</span> {it.descripcion}</span>
                            <span className="num" style={{ textAlign: "right" }}>{formatNumero(it.cantidad)}</span>
                            <span className="num flag" style={{ textAlign: "right" }}><Monto value={it.cantidad > 0 ? it.costo / it.cantidad : 0} /></span>
                            <span className="num" style={{ textAlign: "right" }}><Monto value={it.costo} /></span>
                            <span className="num" style={{ textAlign: "right", fontWeight: 600 }}><Monto value={it.valor} /></span>
                            <span className="num" style={{ textAlign: "right" }}><Monto value={it.valor - it.costo} /></span>
                            <span className="num" style={{ textAlign: "right", fontWeight: 700, color: pIt < 0 ? "var(--bad)" : pIt >= 40 ? "var(--ok)" : undefined }}>
                              {formatPorcentaje(pIt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flag" style={{ background: "var(--surface-2, #f6f8fc)", padding: "8px 12px 10px", fontSize: 12 }}>Sin ítems para este proveedor en el período.</div>
                  )}
                </details>
              );
            })
          )}
        </div>
        {sinCiudad.length > 0 && (
          <div className="card-body" style={{ fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--line)" }}>
            El filtro de ciudad sale de la ciudad del tercero. Hay {sinCiudad.length} IPS con venta y sin ciudad
            registrada, así que ninguna ciudad las incluye (sí se pueden escoger una por una):{" "}
            {sinCiudad.map((o) => o.ips).join(" · ")}. Se completa en{" "}
            <a href="/admin/terceros">Administración → Terceros</a>.
          </div>
        )}
      </div>

      {/* Utilidad por Lista de Precios (abajo). Cada fila es un filtro: al
          hacer clic acota todo el informe a esa lista. */}
      {hayListas ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="chart-head">
            Utilidad por Lista de Precios
            <span className="hact">{periodo} · {porLista.length} lista{porLista.length > 1 ? "s" : ""} · clic en una lista para filtrar</span>
          </div>
          <div className="tbl-wrap">
            <table className="tabla-fit">
              <thead>
                <tr>
                  <th>Lista de precios</th>
                  <th className="r">Venta Neta</th>
                  <th className="r">Costo</th>
                  <th className="r">Utilidad</th>
                  <th className="r">% Utilidad</th>
                  <th className="r">% de la venta</th>
                </tr>
              </thead>
              <tbody>
                {porLista.map((l) => {
                  const u = l.valor - l.costo;
                  const pct = margen(l.valor, l.costo);
                  const activo = listaSel === l.lista;
                  const href = activo
                    ? `${base}&orden=${orden}&dir=${dir}&vista=${vista}`
                    : `${base}&orden=${orden}&dir=${dir}&vista=${vista}&lista=${encodeURIComponent(l.lista)}`;
                  return (
                    <tr key={l.lista} style={activo ? { background: "var(--brand-tint)" } : undefined}>
                      <td style={{ fontWeight: 600 }}>
                        <a href={href} title={activo ? "Quitar filtro" : "Filtrar por esta lista"}
                          style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span aria-hidden style={{ color: "var(--brand)" }}>{activo ? "✓" : "▸"}</span>
                          {nombreLista(l.lista)}
                        </a>
                      </td>
                      <td className="r num"><Monto value={l.valor} /></td>
                      <td className="r num flag"><Monto value={l.costo} /></td>
                      <td className="r num" style={{ fontWeight: 600, color: u < 0 ? "var(--bad)" : undefined }}>
                        <Monto value={u} />
                      </td>
                      <td className="r num" style={{ fontWeight: 700, color: pct < 0 ? "var(--bad)" : pct >= 40 ? "var(--ok)" : undefined }}>
                        {formatPorcentaje(pct)}
                      </td>
                      <td className="r num flag">
                        {ventaListas > 0 ? formatPorcentaje((l.valor / ventaListas) * 100) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
