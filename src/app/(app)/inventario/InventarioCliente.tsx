"use client";
// ==========================================================
// Tabla maestra del inventario: filtros, alta de equipos, edición de
// ítems y registro de novedades. Todo vía server actions.
// ==========================================================
import { useEffect, useMemo, useRef, useState, useActionState, type RefObject } from "react";
import {
  crearEquipoAction, eliminarEquipoAction, crearItemAction, actualizarItemAction,
  eliminarItemAction, registrarNovedadAction, type AccionState,
} from "./actions";
import { SelectOCrear } from "./SelectOCrear";

// ---- Tipos que llegan del servidor (planos) ----
type Estado = "activo" | "en_reparacion" | "de_baja" | "pendiente";
type TipoItem = "equipo" | "accesorio";
export interface Item {
  id: number; descripcion: string; tipo: TipoItem; cantidad: number;
  lote: string | null; estado: Estado; observaciones: string | null;
}
export interface Equipo {
  id: number; codigo: string | null; sedeId: number; sede: string; ciudad: string; categoria: string;
  marca: string; nombre: string | null; observaciones: string | null;
  items: Item[]; totalItems: number; estados: Record<Estado, number>;
}
interface Sede { id: number; nombre: string; ciudad: string; }
interface Props {
  equipos: Equipo[];
  sedes: Sede[];
  categorias: string[];
  marcas: string[];
  puedeGestionar: boolean;
}

const ESTADOS: Estado[] = ["activo", "en_reparacion", "de_baja", "pendiente"];
const EST_LABEL: Record<Estado, string> = { activo: "Activo", en_reparacion: "En reparación", de_baja: "De baja", pendiente: "Pendiente" };
const EST_CLASE: Record<Estado, string> = { activo: "t-ok", en_reparacion: "t-w1", de_baja: "t-bad", pendiente: "t-blue" };
const EST_ICONO: Record<Estado, string> = { activo: "✅", en_reparacion: "🔧", de_baja: "🚫", pendiente: "⏳" };
const TIPO_LABEL: Record<TipoItem, string> = { equipo: "Equipo", accesorio: "Accesorio" };
const NOV_OP = [
  { v: "reparacion", l: "🔧 Enviar a reparación" },
  { v: "retorno_reparacion", l: "↩️ Retorno de reparación" },
  { v: "dano", l: "⚠️ Reportar daño" },
  { v: "baja", l: "🚫 Dar de baja" },
  { v: "traslado", l: "🚚 Trasladar entre sedes" },
] as const;

function useCerrarAlOk(state: AccionState, dialog: RefObject<HTMLDialogElement | null>, onOk?: () => void) {
  useEffect(() => {
    if (state.ok) { dialog.current?.close(); onOk?.(); }
  }, [state.ok]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function InventarioCliente({ equipos, sedes, categorias, marcas, puedeGestionar }: Props) {
  const [fCiudad, setFCiudad] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [q, setQ] = useState("");

  const ciudades = useMemo(() => [...new Set(equipos.map((e) => e.ciudad))].sort(), [equipos]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return equipos
      .filter((e) => !fCiudad || e.ciudad === fCiudad)
      .filter((e) => !fCategoria || e.categoria === fCategoria)
      .map((e) => {
        // Coincidencia a nivel de equipo (código, marca o categoría): muestra todo el equipo.
        const equipoMatch = !t
          || (e.codigo ?? "").toLowerCase().includes(t)
          || e.marca.toLowerCase().includes(t)
          || e.categoria.toLowerCase().includes(t);
        const items = e.items
          .filter((it) => !fEstado || it.estado === fEstado)
          .filter((it) => equipoMatch || it.descripcion.toLowerCase().includes(t) || (it.lote ?? "").toLowerCase().includes(t));
        return { ...e, items };
      })
      .filter((e) => e.items.length > 0);
  }, [equipos, fCiudad, fCategoria, fEstado, q]);

  // Diálogos
  const dEquipo = useRef<HTMLDialogElement>(null);
  const dItem = useRef<HTMLDialogElement>(null);
  const dEditar = useRef<HTMLDialogElement>(null);
  const dNovedad = useRef<HTMLDialogElement>(null);

  const [itemTarget, setItemTarget] = useState<{ equipoId: number } | null>(null);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [novTarget, setNovTarget] = useState<{ equipo: Equipo; item?: Item } | null>(null);

  const totalItems = filtrados.reduce((s, e) => s + e.items.reduce((a, i) => a + i.cantidad, 0), 0);

  return (
    <>
      {/* Filtros */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", padding: 14 }}>
          <div className="toolbar">
            <select className="select" value={fCiudad} onChange={(e) => setFCiudad(e.target.value)}>
              <option value="">📍 Todas las ciudades</option>
              {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="select" value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
              <option value="">🏷️ Todas las categorías</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="select" value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((s) => <option key={s} value={s}>{EST_ICONO[s]} {EST_LABEL[s]}</option>)}
            </select>
            <input className="select" placeholder="🔎 Buscar código, descripción, marca o lote…" value={q}
              onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
            {(fCiudad || fCategoria || fEstado || q) && (
              <button className="btn" onClick={() => { setFCiudad(""); setFCategoria(""); setFEstado(""); setQ(""); }}>Limpiar</button>
            )}
          </div>
          {puedeGestionar && (
            <button className="btn primary" onClick={() => dEquipo.current?.showModal()}>+ Nuevo equipo</button>
          )}
        </div>
      </div>

      {/* Tabla agrupada por equipo */}
      <div className="card">
        <div className="chart-head" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Inventario detallado</span>
          <span className="flag">{filtrados.length} equipos · {totalItems} ítems</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th>Descripción</th>
                <th>Tipo</th>
                <th className="r">Cant.</th>
                <th>Lote / Serial</th>
                <th>Estado</th>
                <th>Observaciones</th>
                {puedeGestionar && <th className="r">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <EquipoBloque
                  key={e.id} equipo={e} puedeGestionar={puedeGestionar}
                  onAddItem={() => { setItemTarget({ equipoId: e.id }); dItem.current?.showModal(); }}
                  onEditItem={(it) => { setEditTarget(it); dEditar.current?.showModal(); }}
                  onNovedad={(it) => { setNovTarget({ equipo: e, item: it }); dNovedad.current?.showModal(); }}
                />
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={puedeGestionar ? 8 : 7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                  Sin resultados con los filtros actuales.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Diálogos ---- */}
      {puedeGestionar && (
        <>
          <DialogEquipo ref={dEquipo} sedes={sedes} categorias={categorias} marcas={marcas} />
          <DialogItem ref={dItem} equipoId={itemTarget?.equipoId ?? 0} />
          <DialogEditar ref={dEditar} item={editTarget} />
          <DialogNovedad ref={dNovedad} target={novTarget} sedes={sedes} />
        </>
      )}
    </>
  );
}

// ---- Bloque de un equipo ----
function EquipoBloque({ equipo, puedeGestionar, onAddItem, onEditItem, onNovedad }: {
  equipo: Equipo; puedeGestionar: boolean;
  onAddItem: () => void; onEditItem: (it: Item) => void; onNovedad: (it?: Item) => void;
}) {
  return (
    <>
      <tr style={{ background: "var(--brand-tint)" }}>
        <td colSpan={puedeGestionar ? 8 : 7} style={{ padding: "8px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {equipo.codigo && <span className="tag" style={{ background: "var(--ink)", color: "var(--surface)", fontFamily: "monospace" }}>{equipo.codigo}</span>}
            <strong>{equipo.categoria}</strong>
            <span className="tag t-blue">{equipo.marca}</span>
            <span className="flag">📍 {equipo.ciudad} · {equipo.sede}</span>
            <span className="flag">{equipo.totalItems} ítems</span>
            {puedeGestionar && (
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button className="btn" onClick={onAddItem}>+ Ítem</button>
                <button className="btn" onClick={() => onNovedad(undefined)}>Novedad</button>
                <EliminarEquipo equipoId={equipo.id} etiqueta={`${equipo.categoria} · ${equipo.marca}`} />
              </span>
            )}
          </div>
        </td>
      </tr>
      {equipo.items.map((it, i) => (
        <tr key={it.id}>
          <td className="flag">{i + 1}</td>
          <td style={{ fontWeight: 600 }}>{it.descripcion}</td>
          <td><span className={`tag ${it.tipo === "equipo" ? "t-blue" : ""}`}>{TIPO_LABEL[it.tipo]}</span></td>
          <td className="r num">{it.cantidad}</td>
          <td className="num flag">{it.lote ?? "—"}</td>
          <td><span className={`tag ${EST_CLASE[it.estado]}`}>{EST_ICONO[it.estado]} {EST_LABEL[it.estado]}</span></td>
          <td className="flag" style={{ maxWidth: 220 }}>{it.observaciones ?? "—"}</td>
          {puedeGestionar && (
            <td className="r">
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => onEditItem(it)} title="Editar">✏️</button>
                <button className="btn" onClick={() => onNovedad(it)} title="Novedad">🔔</button>
                <EliminarItem itemId={it.id} />
              </div>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

function EliminarEquipo({ equipoId, etiqueta }: { equipoId: number; etiqueta: string }) {
  const [, action] = useActionState(eliminarEquipoAction, {});
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(`¿Eliminar el equipo "${etiqueta}" y TODOS sus ítems y novedades? Esta acción no se puede deshacer.`)) e.preventDefault(); }} style={{ display: "inline" }}>
      <input type="hidden" name="equipoId" value={equipoId} />
      <button className="btn" title="Eliminar equipo" type="submit">🗑️ Equipo</button>
    </form>
  );
}

function EliminarItem({ itemId }: { itemId: number }) {
  const [, action] = useActionState(eliminarItemAction, {});
  return (
    <form action={action} onSubmit={(e) => { if (!confirm("¿Eliminar este ítem?")) e.preventDefault(); }} style={{ display: "inline" }}>
      <input type="hidden" name="itemId" value={itemId} />
      <button className="btn" title="Eliminar" type="submit">🗑️</button>
    </form>
  );
}

// ---- Diálogo: nuevo equipo ----
const DialogEquipo = ({ ref, sedes, categorias, marcas }: {
  ref: RefObject<HTMLDialogElement | null>; sedes: Sede[]; categorias: string[]; marcas: string[];
}) => {
  const [state, action, pending] = useActionState(crearEquipoAction, {});
  useCerrarAlOk(state, ref);
  return (
    <dialog ref={ref} className="dlg">
      <form action={action} className="form-crear" style={{ margin: 0, minWidth: 340 }}>
        <h3 style={{ marginTop: 0 }}>Nuevo equipo</h3>
        <div className="form-grid">
          <div className="field"><label>Sede</label>
            <select name="sedeId" required defaultValue="">
              <option value="" disabled>Selecciona…</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.ciudad} · {s.nombre}</option>)}
            </select>
          </div>
          <div className="field"><label>Categoría</label>
            <SelectOCrear name="categoria" opciones={categorias} required placeholder="Nueva categoría…" crearLabel="➕ Crear nueva categoría…" />
          </div>
          <div className="field"><label>Marca / Modelo</label>
            <SelectOCrear name="marca" opciones={marcas} required placeholder="Nueva marca / modelo…" crearLabel="➕ Crear nueva marca…" />
          </div>
          <div className="field"><label>Nombre (opcional)</label><input name="nombre" placeholder="Motor Hall #1" /></div>
        </div>
        <div className="field"><label>Observaciones</label><input name="observaciones" /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" name="esCompra" defaultChecked /> Registrar como compra (alta) en novedades
        </label>
        {state.error && <p className="alert" style={{ color: "var(--bad)" }}>{state.error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancelar</button>
          <button className="btn primary" disabled={pending}>{pending ? "Guardando…" : "Crear equipo"}</button>
        </div>
      </form>
    </dialog>
  );
};

// ---- Diálogo: nuevo ítem ----
const DialogItem = ({ ref, equipoId }: { ref: RefObject<HTMLDialogElement | null>; equipoId: number }) => {
  const [state, action, pending] = useActionState(crearItemAction, {});
  useCerrarAlOk(state, ref);
  return (
    <dialog ref={ref} className="dlg">
      <form action={action} className="form-crear" style={{ margin: 0, minWidth: 340 }} key={equipoId}>
        <h3 style={{ marginTop: 0 }}>Agregar ítem</h3>
        <input type="hidden" name="equipoId" value={equipoId} />
        <div className="form-grid">
          <div className="field"><label>Descripción</label><input name="descripcion" required placeholder="PIEZA DE MANO" /></div>
          <div className="field"><label>Tipo</label>
            <select name="tipo" defaultValue="accesorio"><option value="accesorio">Accesorio</option><option value="equipo">Equipo</option></select>
          </div>
          <div className="field"><label>Cantidad</label><input name="cantidad" type="number" min={1} defaultValue={1} required /></div>
          <div className="field"><label>Estado</label>
            <select name="estado" defaultValue="activo">{ESTADOS.map((s) => <option key={s} value={s}>{EST_LABEL[s]}</option>)}</select>
          </div>
          <div className="field"><label>Lote / Serial</label><input name="lote" /></div>
          <div className="field"><label>Observaciones</label><input name="observaciones" /></div>
        </div>
        {state.error && <p className="alert" style={{ color: "var(--bad)" }}>{state.error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancelar</button>
          <button className="btn primary" disabled={pending}>{pending ? "Guardando…" : "Agregar"}</button>
        </div>
      </form>
    </dialog>
  );
};

// ---- Diálogo: editar ítem ----
const DialogEditar = ({ ref, item }: { ref: RefObject<HTMLDialogElement | null>; item: Item | null }) => {
  const [state, action, pending] = useActionState(actualizarItemAction, {});
  useCerrarAlOk(state, ref);
  if (!item) return <dialog ref={ref} className="dlg" />;
  return (
    <dialog ref={ref} className="dlg">
      <form action={action} className="form-crear" style={{ margin: 0, minWidth: 340 }} key={item.id}>
        <h3 style={{ marginTop: 0 }}>Editar ítem</h3>
        <input type="hidden" name="itemId" value={item.id} />
        <div className="form-grid">
          <div className="field"><label>Descripción</label><input name="descripcion" required defaultValue={item.descripcion} /></div>
          <div className="field"><label>Tipo</label>
            <select name="tipo" defaultValue={item.tipo}><option value="accesorio">Accesorio</option><option value="equipo">Equipo</option></select>
          </div>
          <div className="field"><label>Cantidad</label><input name="cantidad" type="number" min={1} defaultValue={item.cantidad} required /></div>
          <div className="field"><label>Estado</label>
            <select name="estado" defaultValue={item.estado}>{ESTADOS.map((s) => <option key={s} value={s}>{EST_LABEL[s]}</option>)}</select>
          </div>
          <div className="field"><label>Lote / Serial</label><input name="lote" defaultValue={item.lote ?? ""} /></div>
          <div className="field"><label>Observaciones</label><input name="observaciones" defaultValue={item.observaciones ?? ""} /></div>
        </div>
        {state.error && <p className="alert" style={{ color: "var(--bad)" }}>{state.error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancelar</button>
          <button className="btn primary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </dialog>
  );
};

// ---- Diálogo: registrar novedad ----
const DialogNovedad = ({ ref, target, sedes }: {
  ref: RefObject<HTMLDialogElement | null>; target: { equipo: Equipo; item?: Item } | null; sedes: Sede[];
}) => {
  const [state, action, pending] = useActionState(registrarNovedadAction, {});
  const [tipo, setTipo] = useState<string>("reparacion");
  useCerrarAlOk(state, ref);
  if (!target) return <dialog ref={ref} className="dlg" />;
  const { equipo, item } = target;
  return (
    <dialog ref={ref} className="dlg">
      <form action={action} className="form-crear" style={{ margin: 0, minWidth: 360 }} key={`${equipo.id}-${item?.id ?? "eq"}`}>
        <h3 style={{ marginTop: 0 }}>Registrar novedad</h3>
        <p className="flag" style={{ marginTop: -6 }}>
          {equipo.categoria} · {equipo.marca} · 📍 {equipo.ciudad}{item ? ` — ${item.descripcion}` : " (todo el equipo)"}
        </p>
        <input type="hidden" name="equipoId" value={equipo.id} />
        {item && <input type="hidden" name="itemId" value={item.id} />}
        <div className="form-grid">
          <div className="field"><label>Tipo de novedad</label>
            <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {NOV_OP.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="field"><label>Fecha</label><input name="fecha" type="date" /></div>
          {tipo === "traslado" && (
            <div className="field"><label>Sede destino</label>
              <select name="sedeDestinoId" required defaultValue="">
                <option value="" disabled>Selecciona…</option>
                {sedes.filter((s) => s.id !== equipo.sedeId).map((s) => <option key={s.id} value={s.id}>{s.ciudad} · {s.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="field"><label>Descripción / motivo</label><input name="descripcion" placeholder="Detalle de la novedad" /></div>
        {state.error && <p className="alert" style={{ color: "var(--bad)" }}>{state.error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancelar</button>
          <button className="btn primary" disabled={pending}>{pending ? "Registrando…" : "Registrar"}</button>
        </div>
      </form>
    </dialog>
  );
};
