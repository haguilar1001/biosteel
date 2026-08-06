"use client";
// Formulario de pago a proveedor: selecciona proveedor (recarga documentos
// por query), define moneda/TRM y aplica a documentos con cálculo en vivo.
import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarPagoAction, type PagoState } from "./actions";

interface Proveedor { id: number; nombre: string; moneda: string; }
interface Documento { id: number; numero: string; moneda: string; saldo: number; }
interface Cuenta { id: number; etiqueta: string; }

const cop = (n: number) => "$ " + Math.round(n).toLocaleString("es-CO");

export function PagoForm({
  proveedores, proveedorId, monedaDefault, documentos, cuentas, hoy, trmSugerida,
}: {
  proveedores: Proveedor[];
  proveedorId: number | null;
  monedaDefault: string;
  documentos: Documento[];
  cuentas: Cuenta[];
  hoy: string;
  trmSugerida: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<PagoState, FormData>(registrarPagoAction, {});

  const [moneda, setMoneda] = useState(monedaDefault || "COP");
  const [trm, setTrm] = useState(String(monedaDefault === "USD" ? trmSugerida : 1));
  const [aplicar, setAplicar] = useState<Record<number, string>>({});

  const num = (v: string | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const totalCop = useMemo(() => documentos.reduce((s, d) => s + num(aplicar[d.id]), 0), [aplicar, documentos]);
  const trmNum = num(trm) || 1;
  const valorOrigen = moneda === "COP" ? totalCop : totalCop / trmNum;

  const aplicaciones = documentos
    .filter((d) => num(aplicar[d.id]) > 0)
    .map((d) => ({ documentoId: d.id, valor: num(aplicar[d.id]) }));

  const puedeGuardar =
    proveedorId != null && aplicaciones.length > 0 && trmNum > 0 && (moneda === "COP" || trmNum > 1) && !pending;

  function pagarTodo() {
    const next: Record<number, string> = {};
    for (const d of documentos) next[d.id] = String(Math.round(d.saldo));
    setAplicar(next);
  }

  if (state.ok) {
    return (
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="chart-head" style={{ background: "var(--ok)" }}>Pago registrado</div>
        <div className="card-body">
          <p>✅ Se registró el pago <strong>#{state.pagoId}</strong> y se actualizaron los saldos de los documentos.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <a className="btn primary" href="/pagos">Registrar otro</a>
            <a className="btn" href="/cxp">Ver cuentas por pagar</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="card" style={{ maxWidth: 760 }}>
      <div className="chart-head">Datos del pago</div>
      <div className="card-body">
        {state.error && <div className="alert" role="alert">{state.error}</div>}

        <div className="field">
          <label>Proveedor</label>
          <select
            value={proveedorId ?? ""}
            onChange={(e) => router.push(e.target.value ? `/pagos?proveedorId=${e.target.value}` : "/pagos")}
          >
            <option value="">— Selecciona un proveedor —</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.moneda})</option>)}
          </select>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Fecha</label>
            <input type="date" name="fecha" defaultValue={hoy} required />
          </div>
          <div className="field">
            <label>Banco / Cuenta</label>
            <select name="cuentaId" defaultValue="">
              <option value="">— Sin especificar —</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Moneda</label>
            <select value={moneda} onChange={(e) => { setMoneda(e.target.value); setTrm(e.target.value === "COP" ? "1" : String(trmSugerida)); }}>
              <option value="COP">COP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="field">
            <label>TRM del día</label>
            <input inputMode="decimal" value={trm} onChange={(e) => setTrm(e.target.value.replace(/[^\d.]/g, ""))}
              disabled={moneda === "COP"} />
          </div>
        </div>

        <div className="subhead">Aplicar a documentos</div>
        {proveedorId == null ? (
          <div className="empty">Selecciona un proveedor para ver sus documentos.</div>
        ) : documentos.length === 0 ? (
          <div className="empty">Este proveedor no tiene documentos por pagar.</div>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>
              <button type="button" className="btn" onClick={pagarTodo}>Pagar saldo total</button>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Documento</th><th>Mon.</th><th className="r">Saldo COP</th><th className="r">Aplicar COP</th></tr></thead>
                <tbody>
                  {documentos.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.numero}</td>
                      <td>{d.moneda}</td>
                      <td className="r num">{cop(d.saldo)}</td>
                      <td className="r">
                        <input inputMode="numeric" value={aplicar[d.id] ?? ""}
                          onChange={(e) => setAplicar((a) => ({ ...a, [d.id]: e.target.value.replace(/[^\d]/g, "") }))}
                          placeholder="0" style={{ width: 130, textAlign: "right" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--line)" }}>
                    <td colSpan={2} style={{ fontWeight: 700 }}>Total a pagar</td>
                    <td className="r flag">{moneda !== "COP" ? `≈ ${moneda === "USD" ? "US$" : moneda + " "} ${Math.round(valorOrigen).toLocaleString("es-CO")}` : ""}</td>
                    <td className="r num" style={{ fontWeight: 800, color: "var(--brand)" }}>{cop(totalCop)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        <input type="hidden" name="proveedorId" value={proveedorId ?? ""} />
        <input type="hidden" name="moneda" value={moneda} />
        <input type="hidden" name="trmPago" value={trmNum} />
        <input type="hidden" name="aplicaciones" value={JSON.stringify(aplicaciones)} />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <a className="btn" href="/cxp">Cancelar</a>
          <button type="submit" className="btn primary" disabled={!puedeGuardar}>
            {pending ? "Guardando…" : "Guardar pago"}
          </button>
        </div>
      </div>
    </form>
  );
}
