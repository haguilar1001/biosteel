// ==========================================================
// Parámetros de Notas Crédito — porcentajes de descuento por IPS/concepto y
// su vigencia. Editables: cambiar %, fechas, agregar y quitar. Alimentan el
// motor de reliquidación (aplica al reimportar/recargar).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { agregarParametro, editarParametro, quitarParametro } from "./actions";

const IPS = ["CAMPBELL", "BARU", "MOVID", "VALLE", "AZALUD", "CM BAHIA", "OTRAS_IPS"];
const CONCEPTOS = ["BRACE", "ALTO_COSTO", "MAXILO", "APROVECHAMIENTO", "MOS", "ADRES"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function ParametrosNCPage() {
  await requirePermiso("ventas.manage");
  const params = await prisma.parametroNotaCredito.findMany({
    orderBy: [{ ips: "asc" }, { concepto: "asc" }, { fechaInicio: "asc" }],
  });

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Agregar parámetro</div>
        <div className="card-body">
          <form action={agregarParametro} className="toolbar" style={{ flexWrap: "wrap", alignItems: "center" }}>
            <select name="ips" className="select" required defaultValue="">
              <option value="" disabled>IPS…</option>
              {IPS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select name="concepto" className="select" required defaultValue="">
              <option value="" disabled>Concepto…</option>
              {CONCEPTOS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <input type="number" name="pct" step="0.01" min="0" placeholder="%" className="select" style={{ width: 90 }} required />
            <label className="flag">Desde</label>
            <input type="date" name="fechaInicio" className="select" required />
            <label className="flag">Hasta</label>
            <input type="date" name="fechaFin" className="select" required />
            <button type="submit" className="btn primary">Agregar</button>
          </form>
          <p className="flag" style={{ marginTop: 8, marginBottom: 0 }}>El % se ingresa como número (p.ej. <strong>25</strong> = 25 %). Los cambios se reflejan al <strong>reliquidar</strong> (reimportar o recarga por lote).</p>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">Parámetros de descuento (Notas Crédito) <span className="hact">{params.length}</span></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="toolbar" style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--muted)", letterSpacing: ".5px", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
            <span style={{ width: 110 }}>IPS</span>
            <span style={{ width: 150 }}>Concepto</span>
            <span style={{ width: 90 }}>%</span>
            <span style={{ width: 150 }}>Desde</span>
            <span style={{ width: 150 }}>Hasta</span>
            <span>Acciones</span>
          </div>
          {params.length === 0 ? (
            <div className="empty">Sin parámetros. Agrega el primero arriba o corre <code>npm run db:params-nc</code>.</div>
          ) : (
            params.map((p) => (
              <form key={p.id} action={editarParametro} className="toolbar" style={{ alignItems: "center" }}>
                <input type="hidden" name="id" value={p.id} />
                <span className="num" style={{ width: 110, fontWeight: 600 }}>{p.ips}</span>
                <span style={{ width: 150 }}>{p.concepto}</span>
                <input type="number" name="pct" step="0.01" min="0" defaultValue={Math.round(p.pct.toNumber() * 10000) / 100} className="select" style={{ width: 90 }} required />
                <input type="date" name="fechaInicio" defaultValue={iso(p.fechaInicio)} className="select" style={{ width: 150 }} required />
                <input type="date" name="fechaFin" defaultValue={iso(p.fechaFin)} className="select" style={{ width: 150 }} required />
                <button type="submit" className="btn primary">Guardar</button>
                <button type="submit" className="btn" formAction={quitarParametro}>Quitar</button>
              </form>
            ))
          )}
        </div>
      </div>
    </>
  );
}
