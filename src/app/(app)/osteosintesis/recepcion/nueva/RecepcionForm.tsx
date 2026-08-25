"use client";
// ==========================================================
// Formulario del FOR-ALM-005. Secciones 1–4 + ítems con sus 9 criterios.
// Al guardar, ofrece abrir el PDF del recibo a satisfacción.
// ==========================================================
import { useState, useActionState } from "react";
import { crearRecepcionAction, type RecepcionState } from "../actions";

type Result = "conforme" | "no_conforme" | "cuarentena";
interface ItemForm {
  codigo: string; descripcion: string; especificacion: string;
  cantPedida: string; cantRecibida: string; lote: string; fechaCaducidad: string; observaciones: string;
  criterios: Result[];
}
interface Props {
  tipo: string; consecutivo: string; proveedores: string[];
  criterios: string[]; docs: { campo: string; label: string }[];
}

const RES: { v: Result; l: string }[] = [
  { v: "conforme", l: "Conforme" }, { v: "no_conforme", l: "No conforme" }, { v: "cuarentena", l: "Cuarentena" },
];
const VERIF = [{ v: "si", l: "Sí" }, { v: "no", l: "No" }, { v: "na", l: "N/A" }];
const RESULTADOS = ["Aceptado", "Aceptado con observaciones", "Cuarentena", "Rechazado"];

export default function RecepcionForm({ tipo, consecutivo, proveedores, criterios, docs }: Props) {
  const [state, action, pending] = useActionState<RecepcionState, FormData>(crearRecepcionAction, {});
  const nuevoItem = (): ItemForm => ({
    codigo: "", descripcion: "", especificacion: "", cantPedida: "", cantRecibida: "",
    lote: "", fechaCaducidad: "", observaciones: "", criterios: criterios.map(() => "conforme"),
  });
  const [items, setItems] = useState<ItemForm[]>([nuevoItem()]);

  const setItem = (i: number, k: keyof ItemForm, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const setCrit = (i: number, c: number, v: Result) =>
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
            <div className="field"><label>Hora recepción</label><input name="horaRecepcion" type="time" /></div>
            <div className="field"><label>N° ODC / Pedido</label><input name="odcPedido" /></div>
            <div className="field"><label>Proveedor *</label>
              <input name="proveedorNombre" list="proveedores-dl" required placeholder="Nombre del proveedor" />
              <datalist id="proveedores-dl">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="field"><label>Registro INVIMA</label><input name="registroInvima" /></div>
            <div className="field"><label>Factura / Remisión</label><input name="facturaRemision" /></div>
            <div className="field"><label>Valor factura</label><input name="valorFactura" type="number" min={0} step="0.01" /></div>
            <div className="field"><label>N° guía transporte</label><input name="guiaTransporte" /></div>
            <div className="field"><label>Transportador</label><input name="transportador" /></div>
            <div className="field"><label>N° lote despacho</label><input name="loteDespacho" /></div>
            <div className="field"><label>Fecha caducidad</label><input name="fechaCaducidad" type="date" /></div>
            <div className="field"><label>Cant. ODC</label><input name="cantOdc" type="number" min={0} /></div>
          </div>
        </div>
      </div>

      {/* 2. Verificación documental */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">2. Verificación documental previa</div>
        <div className="card-body">
          <div className="form-grid">
            {docs.map((d) => (
              <div className="field" key={d.campo}>
                <label>{d.label}</label>
                <select name={d.campo} defaultValue="na">
                  {VERIF.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="subhead" style={{ margin: "10px 0 6px" }}>Condiciones de transporte y embalaje externo</div>
          <div className="toolbar" style={{ gap: 16, flexWrap: "wrap" }}>
            <label className="flag"><input type="checkbox" name="transSinDanos" /> Sin daños</label>
            <label className="flag"><input type="checkbox" name="transConDanos" /> Con daños</label>
            <label className="flag"><input type="checkbox" name="transSelloViolado" /> Sello violado</label>
            <label className="flag"><input type="checkbox" name="transTempAdecuada" /> Temp. adecuada</label>
            <label className="flag"><input type="checkbox" name="transTempNoAdecuada" /> Temp. no adecuada</label>
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
                <div className="field"><label>Especificación requerida</label><input value={it.especificacion} onChange={(e) => setItem(i, "especificacion", e.target.value)} className="select" /></div>
                <div className="field"><label>Cant. pedida</label><input type="number" min={0} value={it.cantPedida} onChange={(e) => setItem(i, "cantPedida", e.target.value)} className="select" /></div>
                <div className="field"><label>Cant. recibida</label><input type="number" min={0} value={it.cantRecibida} onChange={(e) => setItem(i, "cantRecibida", e.target.value)} className="select" /></div>
                <div className="field"><label>Lote</label><input value={it.lote} onChange={(e) => setItem(i, "lote", e.target.value)} className="select" /></div>
                <div className="field"><label>Fecha caducidad</label><input type="date" value={it.fechaCaducidad} onChange={(e) => setItem(i, "fechaCaducidad", e.target.value)} className="select" /></div>
                <div className="field" style={{ gridColumn: "span 2" }}><label>Observaciones</label><input value={it.observaciones} onChange={(e) => setItem(i, "observaciones", e.target.value)} className="select" /></div>
              </div>
              <div className="subhead" style={{ margin: "10px 0 6px" }}>Criterios de inspección</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", alignItems: "center" }}>
                {criterios.map((c, k) => (
                  <div key={k} style={{ display: "contents" }}>
                    <span style={{ fontSize: 12.5 }}>{k + 1}. {c}</span>
                    <select value={it.criterios[k]} onChange={(e) => setCrit(i, k, e.target.value as Result)} className="select" style={{ maxWidth: 160 }}>
                      {RES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                ))}
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
