// ==========================================================
// Parámetros de Notas Crédito — porcentajes de descuento por IPS/concepto y
// su vigencia. Alimentan el motor de reliquidación. (Vista de consulta.)
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { formatFecha, formatPorcentaje } from "@/lib/format";

export default async function ParametrosNCPage() {
  await requirePermiso("ventas.manage");
  const params = await prisma.parametroNotaCredito.findMany({
    orderBy: [{ ips: "asc" }, { concepto: "asc" }, { fechaInicio: "asc" }],
  });

  return (
    <div className="card">
      <div className="chart-head">Parámetros de descuento (Notas Crédito) <span className="hact">{params.length}</span></div>
      <div className="tbl-wrap">
        <table className="tabla-fit">
          <thead>
            <tr><th>IPS</th><th>Concepto</th><th className="r">%</th><th>Desde</th><th>Hasta</th></tr>
          </thead>
          <tbody>
            {params.length === 0 ? (
              <tr><td colSpan={5}><div className="empty">Sin parámetros. Corre <code>npm run db:params-nc</code>.</div></td></tr>
            ) : (
              params.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.ips}</td>
                  <td>{p.concepto}</td>
                  <td className="r num">{formatPorcentaje(p.pct.toNumber(), true)}</td>
                  <td className="flag">{formatFecha(p.fechaInicio)}</td>
                  <td className="flag">{formatFecha(p.fechaFin)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
