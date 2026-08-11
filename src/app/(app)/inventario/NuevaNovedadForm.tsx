"use client";
// ==========================================================
// Punto de entrada de novedades desde la página de Novedades:
// elige equipo → tipo → (ítem/sede destino) → registra.
// Reutiliza registrarNovedadAction.
// ==========================================================
import { useEffect, useRef, useState, useActionState } from "react";
import { registrarNovedadAction } from "./actions";

interface EquipoOpc {
  id: number; etiqueta: string; ciudad: string; sedeId: number;
  items: { id: number; descripcion: string }[];
}
interface Sede { id: number; nombre: string; ciudad: string; }

const NOV_OP = [
  { v: "compra", l: "🆕 Compra / Alta" },
  { v: "reparacion", l: "🔧 Enviar a reparación" },
  { v: "retorno_reparacion", l: "↩️ Retorno de reparación" },
  { v: "dano", l: "⚠️ Reportar daño" },
  { v: "baja", l: "🚫 Dar de baja" },
  { v: "traslado", l: "🚚 Trasladar entre sedes" },
] as const;

export default function NuevaNovedadForm({ equipos, sedes }: { equipos: EquipoOpc[]; sedes: Sede[] }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(registrarNovedadAction, {} as { ok?: boolean; error?: string });
  const [equipoId, setEquipoId] = useState<number | "">("");
  const [tipo, setTipo] = useState<string>("reparacion");

  useEffect(() => { if (state.ok) { dlg.current?.close(); setEquipoId(""); setTipo("reparacion"); } }, [state.ok]);

  const equipo = equipos.find((e) => e.id === equipoId);

  return (
    <>
      <button className="btn primary" onClick={() => dlg.current?.showModal()}>➕ Registrar novedad</button>

      <dialog ref={dlg} className="dlg">
        <form action={action} className="form-crear" style={{ margin: 0, minWidth: 360 }}>
          <h3 style={{ marginTop: 0 }}>Registrar novedad</h3>

          <div className="form-grid">
            <div className="field"><label>Equipo</label>
              <select name="equipoId" required value={equipoId}
                onChange={(e) => setEquipoId(e.target.value ? Number(e.target.value) : "")}>
                <option value="" disabled>Selecciona un equipo…</option>
                {equipos.map((e) => <option key={e.id} value={e.id}>{e.ciudad} · {e.etiqueta}</option>)}
              </select>
            </div>
            <div className="field"><label>Tipo de novedad</label>
              <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {NOV_OP.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
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

          {state.error && <p className="alert" style={{ color: "var(--bad)" }}>{state.error}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={() => dlg.current?.close()}>Cancelar</button>
            <button className="btn primary" disabled={pending || !equipoId}>{pending ? "Registrando…" : "Registrar"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
