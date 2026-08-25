"use client";
// ==========================================================
// Formulario del FOR-ALM-005. Secciones 1–4 + ítems con sus 9 criterios.
// Al guardar, ofrece abrir el PDF del recibo a satisfacción.
// ==========================================================
import { useState, useActionState } from "react";
import { crearRecepcionAction, type RecepcionState } from "../actions";

interface CriterioUI { nombre: string; especificacion: string; opciones: string[] }
interface ItemForm {
  codigo: string; descripcion: string;
  cantPedida: string; cantRecibida: string; lote: string; fechaCaducidad: string; observaciones: string;
  criterios: string[];
}
interface Props {
  tipo: string; consecutivo: string; proveedores: string[];
  monedas: { codigo: string; nombre: string; simbolo: string }[];
  criterios: CriterioUI[]; docs: { campo: string; label: string }[];
}

const VERIF = [{ v: "si", l: "Sí" }, { v: "no", l: "No" }, { v: "na", l: "N/A" }];
const COND_TRANS = [
  { campo: "transSinDanos", label: "Sin daños", bueno: true },
  { campo: "transConDanos", label: "Con daños", bueno: false },
  { campo: "transSelloViolado", label: "Sello violado", bueno: false },
  { campo: "transTempAdecuada", label: "Temp. adecuada", bueno: true },
  { campo: "transTempNoAdecuada", label: "Temp. no adecuada", bueno: false },
];
const RESULTADOS = ["Aceptado", "Aceptado con observaciones", "Cuarentena", "Rechazado"];

export default function RecepcionForm({ tipo, consecutivo, proveedores, monedas, criterios, docs }: Props) {
  const [state, action, pending] = useActionState<RecepcionState, FormData>(crearRecepcionAction, {});
  const nuevoItem = (): ItemForm => ({
    codigo: "", descripcion: "", cantPedida: "", cantRecibida: "",
    lote: "", fechaCaducidad: "", observaciones: "", criterios: criterios.map((c) => c.opciones[0] ?? "Conforme"),
  });
  const [items, setItems] = useState<ItemForm[]>([nuevoItem()]);
  const [docVals, setDocVals] = useState<Record<string, string>>(() => Object.fromEntries(docs.map((d) => [d.campo, "na"])));
  const setDoc = (campo: string, v: string) => setDocVals((p) => ({ ...p, [campo]: v }));
  const [trans, setTrans] = useState<Record<string, boolean>>(() => Object.fromEntries(COND_TRANS.map((c) => [c.campo, false])));
  const toggleTrans = (campo: string) => setTrans((p) => ({ ...p, [campo]: !p[campo] }));

  const setItem = (i: number, k: keyof ItemForm, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const setCrit = (i: number, c: number, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, criterios: it.criterios.map((x, k) => (k === c ? v : x)) } : it)));
  const addItem = () => setItems((p) => [...p, nuevoItem()]);
  const delItem = (i: number) => setItems((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const invalidItems = items.some((it) => !it.descripcion.trim());

  if (state.ok) {
    return (
      <div className="card"><div className="card-body">
        <p className="alert" style={{ color: "var(--ok, #2A9D6B)", fontWeight: 600 }}>
          ✅ Recepción <b>{state.consecutivo}</b> registrada.
        </p>
        <div className="toolbar">
          <a className="btn primary" href={`/soporte/recepcion/${state.id}`} target="_blank" rel="noopener">📄 Abrir PDF (recibo a satisfacción)</a>
          <a className="btn" href="/osteosintesis/recepcion">Ver listado</a>
          <a className="btn" href={`/osteosintesis/recepcion/nueva?tipo=${tipo}`}>➕ Registrar otra</a>
        </div>
      </div></div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="items" value={JSON.stringify(items.map((it) => ({
        ...it, cantPedida: it.cantPedida || 0, cantRecibida: it.cantRecibida || 0,
      })))} />

      {/* 1. Datos de recepción y proveedor */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">1. Datos de recepción y proveedor</div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field"><label>Fecha inspección *</label><input name="fechaInspeccion" type="date" required /></div>
            <div className="field"><label>N° ODC / Pedido</label><input name="odcPedido" /></div>
            <div className="field"><label>Proveedor *</label>
              <input name="proveedorNombre" list="proveedores-dl" required placeholder="Nombre del proveedor" />
              <datalist id="proveedores-dl">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="field"><label>Registro INVIMA</label><input name="registroInvima" /></div>
            <div className="field"><label>Factura / Remisión</label><input name="facturaRemision" /></div>
            <div className="field"><label>Valor factura</label><input name="valorFactura" type="number" min={0} step="0.01" /></div>
            <div className="field"><label>Moneda</label>
              <select name="monedaFactura" defaultValue="USD">
                {monedas.map((m) => <option key={m.codigo} value={m.codigo}>{m.codigo} · {m.nombre}</option>)}
              </select>
            </div>
            <div className="field"><label>N° guía transporte</label><input name="guiaTransporte" /></div>
            <div className="field"><label>Transportador</label><input name="transportador" /></div>
            <div className="field"><label>Cant. ODC</label><input name="cantOdc" type="number" min={0} /></div>
          </div>
        </div>
      </div>

      {/* 2. Verificación documental */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">2. Verificación documental previa</div>
        <div className="card-body">
          <div className="form-grid">
            {docs.map((d) => {
              const val = docVals[d.campo] ?? "na";
              return (
                <div className="field" key={d.campo}>
                  <label>{d.label}</label>
                  <input type="hidden" name={d.campo} value={val} />
                  <div style={{ display: "inline-flex", gap: 4 }}>
                    {VERIF.map((o) => {
                      const sel = val === o.v;
                      const color = o.v === "si" ? "var(--ok, #2A9D6B)" : o.v === "no" ? "var(--bad, #D64545)" : "var(--muted, #64748b)";
                      return (
                        <button type="button" key={o.v} onClick={() => setDoc(d.campo, o.v)} className="btn"
                          style={{ padding: "5px 16px", background: sel ? color : undefined, color: sel ? "#fff" : undefined, borderColor: sel ? color : undefined, fontWeight: sel ? 700 : 400 }}>
                          {o.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="subhead" style={{ margin: "10px 0 6px" }}>Condiciones de transporte y embalaje externo</div>
          <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
            {COND_TRANS.map((c) => {
              const sel = trans[c.campo];
              const color = c.bueno ? "var(--ok, #2A9D6B)" : "var(--bad, #D64545)";
              return (
                <span key={c.campo}>
                  <input type="hidden" name={c.campo} value={sel ? "true" : ""} />
                  <button type="button" onClick={() => toggleTrans(c.campo)} className="btn"
                    style={{ padding: "5px 16px", background: sel ? color : undefined, color: sel ? "#fff" : undefined, borderColor: sel ? color : undefined, fontWeight: sel ? 700 : 400 }}>
                    {c.label}
                  </button>
                </span>
              );
            })}
          </div>
          <div className="field" style={{ marginTop: 8 }}><label>Observación transporte</label><input name="transObservacion" /></div>
        </div>
      </div>

      {/* 3. Inspección física por ítem */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">3. Inspección física de los dispositivos</div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it, i) => (
            <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <b>Ítem {i + 1}</b>
                <button type="button" className="btn" onClick={() => delItem(i)} disabled={items.length === 1}>✕ Quitar</button>
              </div>
              <div className="form-grid">
                <div className="field"><label>Código</label><input value={it.codigo} onChange={(e) => setItem(i, "codigo", e.target.value)} className="select" /></div>
                <div className="field" style={{ gridColumn: "span 2" }}><label>Descripción del material *</label><input value={it.descripcion} onChange={(e) => setItem(i, "descripcion", e.target.value)} className="select" /></div>
                <div className="field"><label>Cant. pedida</label><input type="number" min={0} value={it.cantPedida} onChange={(e) => setItem(i, "cantPedida", e.target.value)} className="select" /></div>
                <div className="field"><label>Cant. recibida</label><input type="number" min={0} value={it.cantRecibida} onChange={(e) => setItem(i, "cantRecibida", e.target.value)} className="select" /></div>
                <div className="field"><label>Lote</label><input value={it.lote} onChange={(e) => setItem(i, "lote", e.target.value)} className="select" /></div>
                <div className="field"><label>Fecha caducidad</label><input type="date" value={it.fechaCaducidad} onChange={(e) => setItem(i, "fechaCaducidad", e.target.value)} className="select" /></div>
                <div className="field" style={{ gridColumn: "span 2" }}><label>Observaciones</label><input value={it.observaciones} onChange={(e) => setItem(i, "observaciones", e.target.value)} className="select" /></div>
              </div>
              <div className="subhead" style={{ margin: "10px 0 6px" }}>Criterios de inspección</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {criterios.map((c, k) => {
                  const val = it.criterios[k] ?? c.opciones[0] ?? "Conforme";
                  return (
                    <div key={k} style={{ borderTop: k ? "1px dotted var(--line)" : undefined, paddingTop: k ? 8 : 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>C{k + 1}. {c.nombre}</div>
                      <div className="flag" style={{ fontSize: 11, margin: "2px 0 6px" }}>{c.especificacion}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {c.opciones.map((o) => {
                          const sel = val === o;
                          const ol = o.trim().toLowerCase();
                          const color = ol === "conforme" ? "var(--ok, #2A9D6B)" : ol === "no aplica" ? "var(--muted, #64748b)" : "var(--bad, #D64545)";
                          return (
                            <button type="button" key={o} onClick={() => setCrit(i, k, o)} className="btn"
                              style={{ padding: "4px 12px", fontSize: 12, background: sel ? color : undefined, color: sel ? "#fff" : undefined, borderColor: sel ? color : undefined, fontWeight: sel ? 700 : 400 }}>
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button type="button" className="btn" onClick={addItem}>+ Agregar ítem</button>
        </div>
      </div>

      {/* 4. Disposición final */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">4. Disposición del lote y decisión final</div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field"><label>Resultado</label>
              <select name="resultado" defaultValue="">
                <option value="">—</option>
                {RESULTADOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field"><label>Área de destino</label><input name="areaDestino" /></div>
            <div className="field"><label>Decisión</label><input name="decision" /></div>
            <div className="field"><label>Acción a tomar</label><input name="accionTomar" /></div>
            <div className="field"><label>Validación factura</label><input name="validacionFactura" /></div>
          </div>
          <div className="subhead" style={{ margin: "10px 0 6px" }}>Firmas / responsables</div>
          <div className="form-grid">
            <div className="field"><label>Recibido por</label><input name="recibidoPor" /></div>
            <div className="field"><label>Revisado por</label><input name="revisadoPor" /></div>
            <div className="field"><label>Aprobado por</label><input name="aprobadoPor" /></div>
          </div>
          <div className="field" style={{ marginTop: 8 }}><label>Notas</label><input name="notas" /></div>
        </div>
      </div>

      {state.error && <p className="alert" style={{ color: "var(--bad)" }}>⚠️ {state.error}</p>}
      <div className="toolbar" style={{ justifyContent: "flex-end" }}>
        <a href="/osteosintesis/recepcion" className="btn">Cancelar</a>
        <button className="btn primary" disabled={pending || invalidItems}>{pending ? "Guardando…" : "💾 Guardar recepción"}</button>
      </div>
    </form>
  );
}
