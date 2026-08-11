"use client";
// ==========================================================
// Registro de novedades desde la página de Novedades.
// - "Compra" crea un EQUIPO NUEVO (con su lista de ítems) y registra la compra.
// - El resto de novedades (reparación, daño, baja, retorno, traslado) se
//   aplican sobre un equipo ya existente.
// ==========================================================
import { useEffect, useRef, useState, useActionState } from "react";
import { registrarNovedadAction, crearEquipoCompraAction } from "./actions";

interface EquipoOpc {
  id: number; etiqueta: string; ciudad: string; sedeId: number; categoria: string; marca: string;
  items: { id: number; descripcion: string; tipo: "equipo" | "accesorio"; cantidad: number; lote: string | null; estado: Estado }[];
}
interface Sede { id: number; nombre: string; ciudad: string; }
interface Props { equipos: EquipoOpc[]; sedes: Sede[]; categorias: string[]; marcas: string[]; }

type Estado = "activo" | "en_reparacion" | "de_baja" | "pendiente";
const ESTADOS: Estado[] = ["activo", "en_reparacion", "de_baja", "pendiente"];
const EST_LABEL: Record<Estado, string> = { activo: "Activo", en_reparacion: "En reparación", de_baja: "De baja", pendiente: "Pendiente" };

const NOV_OP = [
  { v: "compra", l: "🆕 Compra (equipo nuevo)" },
  { v: "reparacion", l: "🔧 Enviar a reparación" },
  { v: "retorno_reparacion", l: "↩️ Retorno de reparación" },
  { v: "dano", l: "⚠️ Reportar daño" },
  { v: "baja", l: "🚫 Dar de baja" },
  { v: "traslado", l: "🚚 Trasladar entre sedes" },
] as const;

interface ItemNuevo { descripcion: string; tipo: "equipo" | "accesorio"; cantidad: number; lote: string; estado: Estado; }
const ITEM_VACIO: ItemNuevo = { descripcion: "", tipo: "accesorio", cantidad: 1, lote: "", estado: "activo" };

export default function NuevaNovedadForm({ equipos, sedes, categorias, marcas }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [novState, novAction, novPending] = useActionState(registrarNovedadAction, {} as { ok?: boolean; error?: string });
  const [compraState, compraAction, compraPending] = useActionState(crearEquipoCompraAction, {} as { ok?: boolean; error?: string });

  const [tipo, setTipo] = useState<string>("compra");
  const [equipoId, setEquipoId] = useState<number | "">("");
  const [items, setItems] = useState<ItemNuevo[]>([{ ...ITEM_VACIO, tipo: "equipo", descripcion: "" }]);
  // Compra: opción de clonar un equipo existente.
  const [baseId, setBaseId] = useState<number | "">("");
  const [cat, setCat] = useState("");
  const [marca, setMarca] = useState("");

  const esCompra = tipo === "compra";
  const equipo = equipos.find((e) => e.id === equipoId);

  const resetCompra = () => { setBaseId(""); setCat(""); setMarca(""); setItems([{ ...ITEM_VACIO, tipo: "equipo" }]); };

  // Al elegir "basar en equipo existente" clona categoría, marca e ítems.
  const clonarDe = (id: number | "") => {
    setBaseId(id);
    const base = equipos.find((e) => e.id === id);
    if (!base) { resetCompra(); return; }
    setCat(base.categoria);
    setMarca(base.marca);
    setItems(base.items.map((it) => ({ descripcion: it.descripcion, tipo: it.tipo, cantidad: it.cantidad, lote: it.lote ?? "", estado: it.estado })));
  };

  // Cierra y resetea al guardar con éxito (cualquiera de las dos acciones).
  useEffect(() => {
    if (novState.ok || compraState.ok) {
      dlg.current?.close();
      setTipo("compra"); setEquipoId(""); resetCompra();
    }
  }, [novState.ok, compraState.ok]);

  const setItem = (i: number, k: keyof ItemNuevo, v: string | number) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const addItem = () => setItems((prev) => [...prev, { ...ITEM_VACIO }]);
  const delItem = (i: number) => setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const compraInvalida = items.length === 0 || items.some((it) => !it.descripcion.trim());

  return (
    <>
      <button className="btn primary" onClick={() => dlg.current?.showModal()}>➕ Registrar novedad</button>

      <dialog ref={dlg} className="dlg">
        <div className="form-crear" style={{ margin: 0, minWidth: 380 }}>
          <h3 style={{ marginTop: 0 }}>Registrar novedad</h3>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Tipo de novedad</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {NOV_OP.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>

          {/* ---------- COMPRA: crear equipo nuevo ---------- */}
          {esCompra ? (
            <form action={compraAction}>
              <input type="hidden" name="items" value={JSON.stringify(items)} />
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Basar en equipo existente (opcional — compras otra unidad)</label>
                <select value={baseId} onChange={(e) => clonarDe(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— Equipo totalmente nuevo —</option>
                  {equipos.map((e) => <option key={e.id} value={e.id}>{e.ciudad} · {e.etiqueta}</option>)}
                </select>
              </div>
              <div className="form-grid">
                <div className="field"><label>Sede</label>
                  <select name="sedeId" required defaultValue="">
                    <option value="" disabled>Selecciona…</option>
                    {sedes.map((s) => <option key={s.id} value={s.id}>{s.ciudad} · {s.nombre}</option>)}
                  </select>
                </div>
                <div className="field"><label>Categoría</label>
                  <input name="categoria" list="cat-nov" required placeholder="MOTOR, CRANEOTOMO…" value={cat} onChange={(e) => setCat(e.target.value)} />
                  <datalist id="cat-nov">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="field"><label>Marca / Modelo</label>
                  <input name="marca" list="marca-nov" required placeholder="STRYKER, HALL…" value={marca} onChange={(e) => setMarca(e.target.value)} />
                  <datalist id="marca-nov">{marcas.map((m) => <option key={m} value={m} />)}</datalist>
                </div>
                <div className="field"><label>Nombre (opcional)</label><input name="nombre" placeholder="Motor Hall #2" /></div>
                <div className="field"><label>Fecha de compra</label><input name="fecha" type="date" /></div>
                <div className="field"><label>Factura / motivo (opcional)</label><input name="descripcion" placeholder="N° factura, proveedor…" /></div>
              </div>

              <div className="subhead" style={{ margin: "6px 0 8px" }}>Ítems del equipo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {items.map((it, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 64px 1fr 1fr 30px", gap: 6, alignItems: "center" }}>
                    <input placeholder="Descripción" value={it.descripcion} onChange={(e) => setItem(i, "descripcion", e.target.value)} className="select" />
                    <select value={it.tipo} onChange={(e) => setItem(i, "tipo", e.target.value)} className="select">
                      <option value="equipo">Equipo</option><option value="accesorio">Accesorio</option>
                    </select>
                    <input type="number" min={1} value={it.cantidad} onChange={(e) => setItem(i, "cantidad", Number(e.target.value))} className="select" title="Cantidad" />
                    <input placeholder="Lote/Serial" value={it.lote} onChange={(e) => setItem(i, "lote", e.target.value)} className="select" />
                    <select value={it.estado} onChange={(e) => setItem(i, "estado", e.target.value)} className="select">
                      {ESTADOS.map((s) => <option key={s} value={s}>{EST_LABEL[s]}</option>)}
                    </select>
                    <button type="button" className="btn" onClick={() => delItem(i)} disabled={items.length === 1} title="Quitar">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn" onClick={addItem} style={{ marginBottom: 12 }}>+ Agregar ítem</button>

              {compraState.error && <p className="alert" style={{ color: "var(--bad)" }}>{compraState.error}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => dlg.current?.close()}>Cancelar</button>
                <button className="btn primary" disabled={compraPending || compraInvalida}>{compraPending ? "Creando…" : "Crear equipo y registrar compra"}</button>
              </div>
            </form>
          ) : (
            /* ---------- Novedad sobre equipo existente ---------- */
            <form action={novAction}>
              <input type="hidden" name="tipo" value={tipo} />
              <div className="form-grid">
                <div className="field"><label>Equipo</label>
                  <select name="equipoId" required value={equipoId} onChange={(e) => setEquipoId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="" disabled>Selecciona un equipo…</option>
                    {equipos.map((e) => <option key={e.id} value={e.id}>{e.ciudad} · {e.etiqueta}</option>)}
                  </select>
                </div>
                <div className="field"><label>Ítem afectado</label>
                  <select name="itemId" defaultValue="" disabled={!equipo}>
                    <option value="">Todo el equipo</option>
                    {equipo?.items.map((it) => <option key={it.id} value={it.id}>{it.descripcion}</option>)}
                  </select>
                </div>
                <div className="field"><label>Fecha</label><input name="fecha" type="date" /></div>
                {tipo === "traslado" && (
                  <div className="field"><label>Sede destino</label>
                    <select name="sedeDestinoId" required defaultValue="">
                      <option value="" disabled>Selecciona…</option>
                      {sedes.filter((s) => s.id !== equipo?.sedeId).map((s) => <option key={s.id} value={s.id}>{s.ciudad} · {s.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="field"><label>Descripción / motivo</label><input name="descripcion" placeholder="Detalle de la novedad" /></div>

              {novState.error && <p className="alert" style={{ color: "var(--bad)" }}>{novState.error}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => dlg.current?.close()}>Cancelar</button>
                <button className="btn primary" disabled={novPending || !equipoId}>{novPending ? "Registrando…" : "Registrar"}</button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
