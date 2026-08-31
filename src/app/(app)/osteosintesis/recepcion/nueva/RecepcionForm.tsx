"use client";
// ==========================================================
// Formulario del FOR-ALM-005. Secciones 1–4 + ítems con sus 9 criterios.
// Al guardar, ofrece abrir el PDF del recibo a satisfacción.
// ==========================================================
import { useState, useActionState, useRef } from "react";
import * as XLSX from "xlsx";
import { crearRecepcionAction, type RecepcionState } from "../actions";

// --- Carga masiva de ítems desde Excel ---------------------------------------
// La sección 3 se llena a mano, ítem por ítem. Para recepciones grandes (70+
// líneas) eso es inviable, así que se ofrece una plantilla .xlsx y un importador
// que la lee en el navegador y rellena los ítems de una vez. Los criterios de
// inspección y la disposición del lote (secciones 3-criterios y 4) se dejan en
// su valor por defecto y se revisan después: el Excel solo trae los datos del
// material, que es lo que se digita en volumen.
const COLS_PLANTILLA = ["Código", "Descripción del material", "Cant. pedida", "Cant. recibida", "Lote", "Fecha caducidad", "Observaciones"];
const EJEMPLO_PLANTILLA = [
  ["1362", "PARAFUSO CORTICAL AUTORROSQUEANTE Ø 3,5×12mm", 20, 20, "25I000666", "2035-10-31", ""],
  ["", "(borra esta fila de ejemplo y pega tus ítems; solo la descripción es obligatoria)", "", "", "", "", ""],
];
/** Normaliza un encabezado: sin tildes, sin puntos, minúsculas, espacios simples. */
const normCol = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\./g, " ").replace(/\s+/g, " ").trim();
const ALIAS: Record<string, string[]> = {
  codigo: ["codigo", "cod", "referencia", "ref"],
  descripcion: ["descripcion del material", "descripcion", "material", "descripcion material", "nombre"],
  cantPedida: ["cant pedida", "cantidad pedida", "pedida", "cant pedido"],
  cantRecibida: ["cant recibida", "cantidad recibida", "recibida"],
  lote: ["lote", "lote no", "numero de lote"],
  fechaCaducidad: ["fecha caducidad", "fecha de caducidad", "caducidad", "vencimiento", "fecha vencimiento", "fecha de vencimiento", "vence"],
  observaciones: ["observaciones", "observacion", "obs", "notas"],
};
/** Serial de fecha de Excel → aaaa-mm-dd, con UTC (independiente de la zona
 *  horaria). Epoch de Excel = 1899-12-30 (serial 0); 25569 días hasta 1970. */
function serialAISO(serial: number): string {
  if (!Number.isFinite(serial) || serial < 1) return "";
  const dosd = (n: number) => String(n).padStart(2, "0");
  const d = new Date(Math.round(serial - 25569) * 86400000);
  return `${d.getUTCFullYear()}-${dosd(d.getUTCMonth() + 1)}-${dosd(d.getUTCDate())}`;
}
/** Cualquier fecha (Date de Excel, serial, o texto dd/mm/aaaa) → "aaaa-mm-dd". */
function aISO(v: unknown): string {
  if (v == null || v === "") return "";
  const dosd = (n: number) => String(n).padStart(2, "0");
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${dosd(v.getMonth() + 1)}-${dosd(v.getDate())}`;
  if (typeof v === "number") return serialAISO(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${dosd(+m[2]!)}-${dosd(+m[3]!)}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/); // dd/mm/aaaa (formato Colombia)
  if (m) { const a = m[3]!.length === 2 ? `20${m[3]}` : m[3]!; return `${a}-${dosd(+m[2]!)}-${dosd(+m[1]!)}`; }
  return "";
}
/** Cantidad de una celda (número o texto) → entero como string, o "". */
const aCant = (v: unknown) => {
  if (v == null || v === "") return "";
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? String(Math.round(n)) : "";
};

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

// --- Disposición del lote (PRO-DT-005 §7.4) ---
// El procedimiento define tres filas —CONFORME, CUARENTENA y NO CONFORME— y
// para cada una fija a dónde va el lote, qué se decide, qué se hace y si la
// factura se valida. Aquí se guardan tal cual, y escoger el resultado llena
// las cuatro casillas de una vez.
//
// El formulario tiene CUATRO resultados y el procedimiento tres: "Aceptado con
// observaciones" sigue siendo un lote conforme —se libera y se almacena
// aprobado— así que comparte la fila de CONFORME. Lo que cambia es que la
// observación queda escrita en el ítem, no la disposición del lote.
//
// Las casillas quedan editables a propósito: el preestablecido es la vía
// normal, no una camisa de fuerza, y si alguien se aparta el formulario lo
// dice en vez de impedirlo.
type ClaveDisp = "areaDestino" | "decision" | "accionTomar" | "validacionFactura";
type Disposicion = Record<ClaveDisp, string>;
const CLAVES_DISP: ClaveDisp[] = ["areaDestino", "decision", "accionTomar", "validacionFactura"];

const CONFORME: Disposicion = {
  areaDestino: "Almacenamiento APROBADO",
  decision: "Liberar lote",
  accionTomar: "Registrar con firma DT / Coord. Calidad",
  validacionFactura: "SI",
};
const DISPOSICION: Record<string, Disposicion> = {
  "Aceptado": CONFORME,
  "Aceptado con observaciones": CONFORME,
  "Cuarentena": {
    areaDestino: "Área de cuarentena",
    decision: "Aislar lote",
    accionTomar: "Iniciar investigación. Notificar DT.",
    validacionFactura: "NO",
  },
  "Rechazado": {
    areaDestino: "Área de rechazados",
    decision: "Rechazar lote",
    accionTomar: "Notificar proveedor. Abrir FOR-DT-005-03.",
    validacionFactura: "NO",
  },
};

/** Opciones de una casilla: las del procedimiento, sin repetir y en su orden. */
const opcionesDisp = (k: ClaveDisp): string[] =>
  [...new Set(RESULTADOS.map((r) => DISPOSICION[r]![k]))];

const CAMPOS_DISP: { campo: ClaveDisp; label: string }[] = [
  { campo: "areaDestino", label: "Área de destino" },
  { campo: "decision", label: "Decisión" },
  { campo: "accionTomar", label: "Acción a tomar" },
];
const VALIDA_FACTURA = ["SI", "NO"];

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
  const [resultado, setResultado] = useState("");
  const [disp, setDisp] = useState<Disposicion>({ areaDestino: "", decision: "", accionTomar: "", validacionFactura: "" });
  const setDispCampo = (campo: ClaveDisp, v: string) => setDisp((p) => ({ ...p, [campo]: v }));

  /** Escoger un resultado llena las cuatro casillas; quitarlo las devuelve. */
  const elegirResultado = (r: string) => {
    const quitando = resultado === r;
    const preset = DISPOSICION[r]!;
    setResultado(quitando ? "" : r);
    setDisp((prev) => {
      if (!quitando) return { ...preset };
      // Al deseleccionar solo se borra lo que seguía siendo el preestablecido:
      // si alguien lo cambió a mano, esa decisión no se le pisa.
      const limpio = { ...prev };
      for (const k of CLAVES_DISP) if (prev[k] === preset[k]) limpio[k] = "";
      return limpio;
    });
  };

  // Si el resultado está marcado y alguna casilla no coincide con la fila del
  // procedimiento, se avisa. Es un formulario de calidad: apartarse puede
  // estar bien, pero tiene que ser visible y deliberado.
  const presetActual = resultado ? DISPOSICION[resultado] : undefined;
  const desviaciones = presetActual
    ? CAMPOS_DISP.filter((c) => disp[c.campo] && disp[c.campo] !== presetActual[c.campo]).map((c) => c.label)
      .concat(disp.validacionFactura && disp.validacionFactura !== presetActual.validacionFactura ? ["Validación factura"] : [])
    : [];

  const setItem = (i: number, k: keyof ItemForm, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const setCrit = (i: number, c: number, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, criterios: it.criterios.map((x, k) => (k === c ? v : x)) } : it)));
  const addItem = () => setItems((p) => [...p, nuevoItem()]);
  const delItem = (i: number) => setItems((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  // --- Carga masiva de ítems ---
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  /** Descarga una plantilla .xlsx con los encabezados y una fila de ejemplo. */
  const descargarPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLS_PLANTILLA, ...EJEMPLO_PLANTILLA]);
    ws["!cols"] = [{ wch: 12 }, { wch: 48 }, { wch: 12 }, { wch: 13 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ítems");
    XLSX.writeFile(wb, "plantilla-recepcion-tecnica.xlsx");
  };

  /** Lee el Excel elegido y reemplaza los ítems con lo que trae. */
  const importarExcel = async (file: File) => {
    setImportMsg(null);
    try {
      const buf = await file.arrayBuffer();
      // Sin cellDates a propósito: las fechas llegan como serial de Excel y las
      // convierte XLSX.SSF (independiente de zona horaria). Con cellDates, xlsx
      // reconstruye un Date que se corre un día según el huso (UTC-5 en Colombia).
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      if (!ws) { setImportMsg({ tipo: "err", texto: "El archivo no tiene hojas." }); return; }
      const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false });
      if (filas.length < 2) { setImportMsg({ tipo: "err", texto: "El archivo no tiene datos debajo de los encabezados." }); return; }

      // Mapea cada campo a su columna por el nombre del encabezado (fila 1).
      const encabezados = (filas[0] as unknown[]).map(normCol);
      const idx: Record<string, number> = {};
      for (const [campo, alias] of Object.entries(ALIAS)) {
        idx[campo] = encabezados.findIndex((h) => alias.includes(h));
      }
      if (idx.descripcion === -1) {
        setImportMsg({ tipo: "err", texto: "No encontré la columna \"Descripción del material\". Usa la plantilla para no cambiar los encabezados." });
        return;
      }
      const cel = (fila: unknown[], campo: string) => (idx[campo]! >= 0 ? fila[idx[campo]!] : undefined);

      const nuevos: ItemForm[] = [];
      let saltadas = 0;
      for (const fila of filas.slice(1) as unknown[][]) {
        const descripcion = String(cel(fila, "descripcion") ?? "").trim();
        if (!descripcion) { saltadas++; continue; } // sin descripción no es un ítem válido
        nuevos.push({
          codigo: String(cel(fila, "codigo") ?? "").trim(),
          descripcion,
          cantPedida: aCant(cel(fila, "cantPedida")),
          cantRecibida: aCant(cel(fila, "cantRecibida")),
          lote: String(cel(fila, "lote") ?? "").trim(),
          fechaCaducidad: aISO(cel(fila, "fechaCaducidad")),
          observaciones: String(cel(fila, "observaciones") ?? "").trim(),
          criterios: criterios.map((c) => c.opciones[0] ?? "Conforme"),
        });
      }
      if (!nuevos.length) { setImportMsg({ tipo: "err", texto: "No encontré filas con descripción para importar." }); return; }
      setItems(nuevos);
      setImportMsg({ tipo: "ok", texto: `✅ ${nuevos.length} ítem(s) importados${saltadas ? ` · ${saltadas} fila(s) sin descripción omitidas` : ""}. Revisa criterios y disposición antes de guardar.` });
    } catch {
      setImportMsg({ tipo: "err", texto: "No pude leer el archivo. Debe ser un Excel (.xlsx) o CSV." });
    }
  };

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
          {/* Carga masiva: plantilla + importación de Excel para recepciones grandes */}
          <div style={{ border: "1px dashed var(--line)", borderRadius: 8, padding: "10px 12px", background: "var(--brand-tint)" }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <b style={{ fontSize: 13 }}>Carga masiva de ítems</b>
              <span className="flag" style={{ fontSize: 11.5 }}>¿Muchas líneas? Descarga la plantilla, pégalas y súbela.</span>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn" onClick={descargarPlantilla}>⬇️ Descargar plantilla</button>
              <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>⬆️ Importar Excel</button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importarExcel(f); e.target.value = ""; }} />
            </div>
            {importMsg && (
              <p className="alert" style={{ margin: "8px 0 0", fontSize: 12.5, color: importMsg.tipo === "ok" ? "var(--ok, #2A9D6B)" : "var(--bad, #D64545)" }}>
                {importMsg.texto}
              </p>
            )}
          </div>
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
        <div className="chart-head">
          4. Disposición del lote y decisión final
          <span className="hact">PRO-DT-005 §7.4</span>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Resultado</label>
              <input type="hidden" name="resultado" value={resultado} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {RESULTADOS.map((r) => {
                  const sel = resultado === r;
                  const color = r === "Aceptado" ? "var(--ok, #2A9D6B)" : r === "Rechazado" ? "var(--bad, #D64545)" : "var(--w1, #E0A400)";
                  return (
                    <button type="button" key={r} onClick={() => elegirResultado(r)} className="btn"
                      style={{ padding: "5px 16px", background: sel ? color : undefined, color: sel ? "#fff" : undefined, borderColor: sel ? color : undefined, fontWeight: sel ? 700 : 400 }}>
                      {r}
                    </button>
                  );
                })}
              </div>
              <div className="flag" style={{ fontSize: 11, marginTop: 4 }}>
                Al marcar el resultado se llenan solas las casillas de abajo con lo que indica el
                procedimiento. Se pueden cambiar.
              </div>
            </div>

            {CAMPOS_DISP.map((c) => (
              <div className="field" key={c.campo}>
                <label>{c.label}</label>
                <select name={c.campo} className="select" value={disp[c.campo]} onChange={(e) => setDispCampo(c.campo, e.target.value)}>
                  <option value="">—</option>
                  {opcionesDisp(c.campo).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}

            {/* Binaria y corta: va en cuadros, como en el formato impreso. */}
            <div className="field"><label>Validación factura</label>
              <input type="hidden" name="validacionFactura" value={disp.validacionFactura} />
              <div style={{ display: "inline-flex", gap: 4 }}>
                {VALIDA_FACTURA.map((o) => {
                  const sel = disp.validacionFactura === o;
                  const color = o === "SI" ? "var(--ok, #2A9D6B)" : "var(--bad, #D64545)";
                  return (
                    <button type="button" key={o} onClick={() => setDispCampo("validacionFactura", sel ? "" : o)} className="btn"
                      style={{ padding: "5px 16px", background: sel ? color : undefined, color: sel ? "#fff" : undefined, borderColor: sel ? color : undefined, fontWeight: sel ? 700 : 400 }}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {desviaciones.length > 0 && (
            <p className="alert" style={{ color: "var(--w1, #E0A400)", fontSize: 12.5, marginTop: 8 }}>
              ⚠️ Para <b>{resultado}</b>, el PRO-DT-005 §7.4 indica otra cosa en{" "}
              <b>{desviaciones.join(", ")}</b>. Puedes guardarlo así, pero deja la razón en las notas.
            </p>
          )}
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
