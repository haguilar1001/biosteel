// ==========================================================
// Ajustes manuales de venta neta — suman/restan a un período para cuadrar con
// Power BI cuando no se conocen las exclusiones exactas. Se aplican al reliquidar.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { formatFecha } from "@/lib/format";
import { Monto } from "../../../_components/Monto";
import { agregarAjuste, quitarAjuste } from "./actions";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default async function AjustesPage() {
  await requirePermiso("ventas.manage");
  const ajustes = await prisma.ajusteVenta.findMany({ orderBy: [{ anio: "desc" }, { mes: "desc" }] });
  const anioActual = new Date().getUTCFullYear();

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Agregar ajuste</div>
        <div className="card-body">
          <form action={agregarAjuste} className="toolbar" style={{ flexWrap: "wrap", alignItems: "center" }}>
            <input type="number" name="anio" defaultValue={anioActual} className="select" style={{ width: 100 }} required aria-label="Año" />
            <select name="mes" className="select" required defaultValue="">
              <option value="" disabled>Mes…</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{MESES[m]}</option>)}
            </select>
            <input type="text" name="concepto" placeholder="Concepto (p.ej. AJUSTE POWER BI)" className="select" style={{ minWidth: 220 }} defaultValue="AJUSTE POWER BI" />
            <input type="number" name="valor" step="0.01" placeholder="Valor (+ sube / − baja)" className="select" style={{ width: 200 }} required aria-label="Valor" />
            <button type="submit" className="btn primary">Agregar</button>
          </form>
          <p className="flag" style={{ marginTop: 8, marginBottom: 0 }}>
            El valor se <strong>suma</strong> a la venta neta del período (negativo la baja). Aparece como una línea del concepto en los desgloses. Se aplica al <strong>reliquidar</strong>.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">Ajustes de venta neta <span className="hact">{ajustes.length}</span></div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead><tr><th>Período</th><th>Concepto</th><th className="r">Valor</th><th>Agregado</th><th className="r">Acción</th></tr></thead>
            <tbody>
              {ajustes.length === 0 ? (
                <tr><td colSpan={5}><div className="empty">Sin ajustes.</div></td></tr>
              ) : (
                ajustes.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{MESES[a.mes]} {a.anio}</td>
                    <td>{a.concepto}</td>
                    <td className="r num" style={{ fontWeight: 700, color: a.valor.toNumber() < 0 ? "var(--bad)" : "var(--ok)" }}>
                      {a.valor.toNumber() >= 0 ? "+" : "−"}<Monto value={Math.abs(a.valor.toNumber())} />
                    </td>
                    <td className="flag">{formatFecha(a.createdAt)}</td>
                    <td className="r">
                      <form action={quitarAjuste} style={{ margin: 0 }}>
                        <input type="hidden" name="id" value={a.id} />
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
