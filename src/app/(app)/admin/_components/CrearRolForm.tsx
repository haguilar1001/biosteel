"use client";
import { useActionState } from "react";
import { crearRolAction, type AdminState } from "../actions";

const init: AdminState = {};

export function CrearRolForm() {
  const [state, action, pending] = useActionState(crearRolAction, init);

  return (
    <details className="panel-crear">
      <summary className="btn primary">➕ Crear perfil</summary>
      <form action={action} className="form-crear">
        {state.error && <div className="alert" role="alert">⚠️ {state.error}</div>}
        {state.ok && <div className="alert ok" role="status">✅ {state.msg}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
            <label>🏷️ Nombre del perfil</label>
            <input name="nombre" required minLength={2} maxLength={40} placeholder="p. ej. Auxiliar contable" autoComplete="off" />
          </div>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Creando…" : "💾 Crear"}
          </button>
        </div>
      </form>
    </details>
  );
}
