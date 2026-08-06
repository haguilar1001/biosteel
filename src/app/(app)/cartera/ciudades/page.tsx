// ==========================================================
// Cartera por Ciudad — con tooltip que despliega el subtotal por IPS.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { carteraPorCiudad } from "@/lib/negocio/cartera";

export default async function CarteraPorCiudadPage() {
  const { usuario, alcance } = await requirePermiso("cartera.view");
  const ciudades = await carteraPorCiudad(usuario, alcance);
  const total = ciudades.reduce((s, c) => s + c.saldo, 0);
  const totalDocs = ciudades.reduce((s, c) => s + c.documentos, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cartera</div>
          <h1>Cartera por ciudad</h1>
          <p>Pasa el mouse sobre una ciudad para ver el subtotal de cada IPS</p>
        </div>
        <div className="toolbar">
          <a href="/cartera" className="btn">← Facturas</a>
          <a href="/cartera/clientes" className="btn">Por cliente</a>
        </div>
      </div>

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
                    <span className="tt-label" style={{ fontWeight: 600 }}>📍 {c.ciudad}</span>
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
