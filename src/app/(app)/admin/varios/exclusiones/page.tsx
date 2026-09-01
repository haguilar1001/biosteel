// ==========================================================
// Exclusiones NC — facturas excluidas manualmente de cualquier descuento.
// El motor las respeta al reliquidar (concepto "TODOS").
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { formatFechaSello } from "@/lib/format";
import { agregarExclusion, quitarExclusion } from "./actions";

export default async function ExclusionesPage() {
  await requirePermiso("ventas.manage");
  const exclusiones = await prisma.exclusionNC.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Agregar exclusión</div>
        <div className="card-body">
          <form action={agregarExclusion} className="toolbar" style={{ flexWrap: "wrap" }}>
            <input type="text" name="nroDocumento" placeholder="Nro documento (p.ej. FET-00109554)" className="select" style={{ minWidth: 260 }} required />
            <input type="text" name="motivo" placeholder="Motivo (opcional)" className="select" style={{ minWidth: 260 }} />
            <button type="submit" className="btn primary">Agregar</button>
          </form>
          <p className="flag" style={{ marginTop: 8, marginBottom: 0 }}>
            Las facturas listadas no reciben descuento (Nota Crédito = 0). El efecto se aplica al <strong>reliquidar</strong> (reimportar o recarga por lote).
          </p>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">Exclusiones NC <span className="hact">{exclusiones.length}</span></div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead><tr><th>Nro documento</th><th>Motivo</th><th>Agregada</th><th className="r">Acción</th></tr></thead>
            <tbody>
              {exclusiones.length === 0 ? (
                <tr><td colSpan={4}><div className="empty">Sin exclusiones. Agrega la primera arriba.</div></td></tr>
              ) : (
                exclusiones.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.nroDocumento}</td>
                    <td className="flag">{e.motivo ?? "—"}</td>
                    <td className="flag">{formatFechaSello(e.createdAt)}</td>
                    <td className="r">
                      <form action={quitarExclusion} style={{ margin: 0 }}>
                        <input type="hidden" name="id" value={e.id} />
                        <button type="submit" className="btn">Quitar</button>
                      </form>
                    </td>
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
