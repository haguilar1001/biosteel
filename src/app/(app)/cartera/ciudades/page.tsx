// ==========================================================
// Cartera por Ciudad — mapa de Colombia + anillo + tabla con tooltip
// que despliega el subtotal por IPS.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { carteraPorCiudad } from "@/lib/negocio/cartera";
import { Donut } from "../../_components/charts/Donut";
import { MapaColombia } from "../../_components/charts/MapaColombia";

const CATS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];

export default async function CarteraPorCiudadPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { usuario, alcance } = await requirePermiso("cartera.view");
  const { vista } = await searchParams;
  const verMapa = vista === "mapa";
  const ciudades = await carteraPorCiudad(usuario, alcance);
  const total = ciudades.reduce((s, c) => s + c.saldo, 0);
  const totalDocs = ciudades.reduce((s, c) => s + c.documentos, 0);

  // Color por ciudad (categórico); "Sin ciudad" en gris.
  let idx = 0;
  const color = new Map<string, string>();
  for (const c of ciudades) color.set(c.ciudad, c.ciudad === "Sin ciudad" ? "var(--muted)" : CATS[idx++ % CATS.length]!);

  const donutData = ciudades.map((c) => ({ label: c.ciudad, valor: c.saldo, color: color.get(c.ciudad)! }));
  const mapaData = ciudades.map((c) => ({ ciudad: c.ciudad, valor: c.saldo, color: color.get(c.ciudad)! }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cartera</div>
          <h1>Cartera por ciudad</h1>
          <p>Pasa el mouse sobre una ciudad para ver el subtotal de cada IPS</p>
        </div>
        <div className="toolbar">
          <a href="/cartera/ciudades?vista=mapa" className={`btn${verMapa ? " primary" : ""}`}>🗺️ Mapa</a>
          <a href="/cartera/ciudades" className={`btn${!verMapa ? " primary" : ""}`}>Tabla</a>
          <a href="/cartera" className="btn">← Facturas</a>
        </div>
      </div>

      {verMapa && (
      <div className="grid two" style={{ marginBottom: 12, gridTemplateColumns: "1fr 1.4fr" }}>
        <div className="card">
          <div className="chart-head">Mapa de cartera</div>
          <div className="card-body" style={{ display: "grid", placeItems: "center" }}>
            <MapaColombia data={mapaData} size={300} />
          </div>
        </div>
        <div className="card">
          <div className="chart-head">Composición por ciudad</div>
          <div className="card-body">
            <Donut data={donutData} centro={{ valor: (total / 1e9).toFixed(1).replace(".", ",") + " MM", etiqueta: "cartera neta" }} />
          </div>
        </div>
      </div>
      )}

      <div className="card card-tt">
        <div className="chart-head">Saldo neto por ciudad <span className="hact">{ciudades.length} ciudades</span></div>
        <table>
          <thead>
            <tr>
              <th>Ciudad</th><th className="r">Saldo neto</th><th className="r">% Part.</th>
              <th className="r">IPS / clientes</th><th className="r">Facturas</th>
            </tr>
          </thead>
          <tbody>
            <tr className="fila-total">
              <td style={{ fontWeight: 800 }}>Total · {ciudades.length} ciudades</td>
              <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(total)}</td>
              <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
              <td className="r num"></td>
              <td className="r num" style={{ fontWeight: 800 }}>{totalDocs}</td>
            </tr>
            {ciudades.map((c) => (
              <tr key={c.ciudad}>
                <td>
                  <span className="tt" tabIndex={0}>
                    <span className="tt-label" style={{ fontWeight: 600 }}>
                      <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: color.get(c.ciudad), marginRight: 7 }} />{c.ciudad}
                    </span>
                    <div className="tt-pop">
                      <h4>IPS en {c.ciudad} · {c.clientes}</h4>
                      {c.ips.map((ips) => (
                        <div className="tt-row" key={ips.cliente}>
                          <span>{ips.cliente} <span className="n">· {ips.documentos} fac.</span></span>
                          <span className="num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatCOP(ips.saldo)}</span>
                        </div>
                      ))}
                      <div className="tt-foot"><span>Total {c.ciudad}</span><span className="num">{formatCOP(c.saldo)}</span></div>
                    </div>
                  </span>
                </td>
                <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(c.saldo)}</td>
                <td className="r num">{total !== 0 ? formatPorcentaje((c.saldo / total) * 100) : "—"}</td>
                <td className="r num">{c.clientes}</td>
                <td className="r num">{c.documentos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
