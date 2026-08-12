// ==========================================================
// Ventas Históricas — matriz Venta Neta: meses en filas, años en columnas,
// con totales por fila (mes en todos los años) y por columna (año completo).
// Réplica de la tabla de Power BI.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP } from "@/lib/format";
import { aniosConVenta, ventaMensualDetalle } from "@/lib/negocio/ventas";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default async function VentasHistoricoPage() {
  await requirePermiso("cxp.view");

  const anios = await aniosConVenta();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin ventas cargadas. Corre <code>npm run db:ventas</code>.</div></div></div>;
  }

  // ventas[a][mes] = venta neta del mes (1–12) de ese año.
  const detalle = await Promise.all(anios.map((a) => ventaMensualDetalle(a)));
  const ventas = new Map<number, number[]>(); // anio -> [null, m1..m12]
  anios.forEach((a, i) => {
    const arr = Array(13).fill(0);
    for (const m of detalle[i]!) arr[m.mes] = m.venta;
    ventas.set(a, arr);
  });

  const totalAnio = new Map<number, number>();
  for (const a of anios) totalAnio.set(a, (ventas.get(a) ?? []).reduce((s, v) => s + (v || 0), 0));
  const granTotal = anios.reduce((s, a) => s + (totalAnio.get(a) ?? 0), 0);

  const celda = (v: number) => (v ? formatCOP(v) : "—");

  return (
    <div className="card">
      <div className="chart-head">Ventas Históricas <span className="hact">venta neta · mes × año</span></div>
      <div className="tbl-wrap">
        <table className="tabla-fit">
          <thead>
            <tr>
              <th>Mes</th>
              {anios.map((a) => <th key={a} className="r">{a}</th>)}
              <th className="r">Total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const fila = anios.map((a) => (ventas.get(a) ?? [])[m] || 0);
              const totFila = fila.reduce((s, v) => s + v, 0);
              if (totFila === 0) return null;
              return (
                <tr key={m}>
                  <td style={{ fontWeight: 600 }}>{MESES[m]}</td>
                  {fila.map((v, j) => <td key={j} className="r num">{celda(v)}</td>)}
                  <td className="r num" style={{ fontWeight: 700 }}>{celda(totFila)}</td>
                </tr>
              );
            })}
            <tr className="fila-total">
              <td style={{ fontWeight: 800 }}>Total</td>
              {anios.map((a) => <td key={a} className="r num" style={{ fontWeight: 800 }}>{celda(totalAnio.get(a) ?? 0)}</td>)}
              <td className="r num" style={{ fontWeight: 800 }}>{celda(granTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
