"use client";
// Formulario de recaudo: selecciona cliente (recarga facturas por query),
// captura valor + retenciones y aplica a facturas con cálculo en vivo.
import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarRecaudoAction, type RecaudoState } from "./actions";

interface Opcion { id: number; nombre: string; }
interface Factura { id: number; numero: string; saldo: number; }
interface Concepto { id: number; nombre: string; porcentaje: number; }
interface Cuenta { id: number; etiqueta: string; }

const cop = (n: number) => "$ " + Math.round(n).toLocaleString("es-CO");

export function RecaudoForm({
  clientes, clienteId, facturas, conceptos, cuentas, hoy,
}: {
  clientes: Opcion[];
  clienteId: number | null;
  facturas: Factura[];
  conceptos: Concepto[];
  cuentas: Cuenta[];
  hoy: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<RecaudoState, FormData>(registrarRecaudoAction, {});

  const [valorRecibido, setValorRecibido] = useState("");
  const [aplicar, setAplicar] = useState<Record<number, string>>({});
  const [reten, setReten] = useState<Record<number, string>>({});

  const num = (v: string | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const totalRet = useMemo(() => conceptos.reduce((s, c) => s + num(reten[c.id]), 0), [reten, conceptos]);
  const vr = num(valorRecibido);
  const aCubrir = vr + totalRet;
  const totalAplicado = useMemo(() => facturas.reduce((s, f) => s + num(aplicar[f.id]), 0), [aplicar, facturas]);
  const diferencia = totalAplicado - aCubrir;

  const aplicaciones = facturas
    .filter((f) => num(aplicar[f.id]) > 0)
    .map((f) => ({ facturaId: f.id, valor: num(aplicar[f.id]) }));
  const retenciones = conceptos
    .filter((c) => num(reten[c.id]) > 0)
    .map((c) => ({ conceptoId: c.id, base: vr, valor: num(reten[c.id]) }));

  const puedeGuardar =
    clienteId != null && vr > 0 && aplicaciones.length > 0 && Math.abs(diferencia) < 1 && !pending;

  // Reparte "a cubrir" entre las facturas más antiguas primero.
  function autoAplicar() {
    let resto = aCubrir;
    const next: Record<number, string> = {};
    for (const f of facturas) {
      if (resto <= 0) { next[f.id] = ""; continue; }
      const v = Math.min(resto, f.saldo);
      next[f.id] = String(Math.round(v));
      resto -= v;
    }
    setAplicar(next);
  }

  if (state.ok) {
    return (
      <div className="card">
        <div className="chart-head" style={{ background: "var(--ok)" }}>Recaudo registrado</div>
        <div className="card-body">
          <p>✅ Se registró el recaudo <strong>#{state.recaudoId}</strong> y se actualizaron los saldos de las facturas.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <a className="btn primary" href="/recaudos">Registrar otro</a>
            <a className="btn" href="/cartera">Ver cartera</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid two">
      {/* --- Datos del recaudo --- */}
      <form action={formAction} className="card">
        <div className="chart-head">Datos del recaudo</div>
        <div className="card-body">
          {state.error && <div className="alert" role="alert">{state.error}</div>}

          {/* Cliente (recarga facturas por query) */}
          <div className="field">
            <label>Cliente</label>
            <select
              value={clienteId ?? ""}
              onChange={(e) => router.push(e.target.value ? `/recaudos?clienteId=${e.target.value}` : "/recaudos")}
            >
              <option value="">— Selecciona un cliente —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Fecha</label>
              <input type="date" name="fecha" defaultValue={hoy} required />
            </div>
            <div className="field">
              <label>Medio de pago</label>
              <select name="medio" defaultValue="transferencia">
                <option value="transferencia">Transferencia</option>
                <option value="consignacion">Consignación</option>
                <option value="cheque">Cheque</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>
            <div className="field">
              <label>Banco / Cuenta</label>
              <select name="cuentaId" defaultValue="">
                <option value="">— Sin especificar —</option>
                {cuentas.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Valor recibido</label>
              <input inputMode="numeric" name="valorRecibido" value={valorRecibido}
                onChange={(e) => setValorRecibido(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0" required />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Referencia</label>
              <input name="referencia" placeholder="N.º de comprobante (opcional)" maxLength={120} />
            </div>
          </div>

          {conceptos.length > 0 && (
            <>
              <div className="subhead">Retenciones aplicadas</div>
              <div className="form-grid">
                {conceptos.map((c) => (
                  <div className="field" key={c.id}>
                    <label>{c.nombre} ({c.porcentaje.toLocaleString("es-CO", { minimumFractionDigits: 2 })} %)</label>
                    <input inputMode="numeric" value={reten[c.id] ?? ""}
                      onChange={(e) => setReten((r) => ({ ...r, [c.id]: e.target.value.replace(/[^\d]/g, "") }))}
                      placeholder="0" />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Payload serializado para la Server Action */}
          <input type="hidden" name="terceroId" value={clienteId ?? ""} />
          <input type="hidden" name="aplicaciones" value={JSON.stringify(aplicaciones)} />
          <input type="hidden" name="retenciones" value={JSON.stringify(retenciones)} />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <a className="btn" href="/cartera">Cancelar</a>
            <button type="submit" className="btn primary" disabled={!puedeGuardar}>
              {pending ? "Guardando…" : "Guardar recaudo"}
            </button>
          </div>
        </div>
      </form>

      {/* --- Aplicar a facturas --- */}
      <div className="card">
        <div className="chart-head">
          Aplicar a facturas
          <span className="hact">Por aplicar {cop(Math.max(0, -diferencia))}</span>
        </div>
        {clienteId == null ? (
          <div className="empty">Selecciona un cliente para ver sus facturas.</div>
        ) : facturas.length === 0 ? (
          <div className="empty">Este cliente no tiene facturas abiertas.</div>
        ) : (
          <>
            <div style={{ padding: "8px 14px" }}>
              <button type="button" className="btn" onClick={autoAplicar} disabled={aCubrir <= 0}>
                Aplicar automáticamente
              </button>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Factura</th><th className="r">Saldo</th><th className="r">Aplicar</th></tr></thead>
                <tbody>
                  {facturas.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.numero}</td>
                      <td className="r num">{cop(f.saldo)}</td>
                      <td className="r">
                        <input inputMode="numeric" value={aplicar[f.id] ?? ""}
                          onChange={(e) => setAplicar((a) => ({ ...a, [f.id]: e.target.value.replace(/[^\d]/g, "") }))}
                          placeholder="0" style={{ width: 120, textAlign: "right" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--line)" }}>
                    <td style={{ fontWeight: 700 }}>Total aplicado</td>
                    <td className="r flag">a cubrir {cop(aCubrir)}</td>
                    <td className="r num" style={{ fontWeight: 800, color: Math.abs(diferencia) < 1 ? "var(--ok)" : "var(--bad)" }}>
                      {cop(totalAplicado)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {Math.abs(diferencia) >= 1 && (
              <div className="card-body" style={{ paddingTop: 0 }}>
                <span className="flag">
                  {diferencia > 0
                    ? `Aplicaste ${cop(diferencia)} de más.`
                    : `Faltan ${cop(-diferencia)} por aplicar (valor recibido + retenciones).`}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
