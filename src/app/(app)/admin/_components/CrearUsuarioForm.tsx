"use client";
import { useActionState } from "react";
import { crearUsuarioAction, type AdminState } from "../actions";

const init: AdminState = {};

export function CrearUsuarioForm({
  roles,
  sedes,
}: {
  roles: { id: number; nombre: string }[];
  sedes: { id: number; nombre: string }[];
}) {
  const [state, action, pending] = useActionState(crearUsuarioAction, init);

  return (
    <details className="panel-crear">
      <summary className="btn primary">➕ Crear usuario</summary>
      <form action={action} className="form-crear">
        {state.error && <div className="alert" role="alert">⚠️ {state.error}</div>}
        {state.ok && <div className="alert ok" role="status">✅ {state.msg}</div>}
        <div className="form-grid">
          <div className="field">
            <label>👤 Nombre</label>
            <input name="nombre" required minLength={2} autoComplete="off" />
          </div>
          <div className="field">
            <label>✉️ Correo</label>
            <input name="email" type="email" required autoComplete="off" />
          </div>
          <div className="field">
            <label>🔑 Contraseña inicial</label>
            <input name="clave" type="password" required autoComplete="new-password" />
            <small className="flag">Mín. 12 caracteres: mayúscula, minúscula, número y símbolo.</small>
          </div>
          <div className="field">
            <label>🏷️ Perfil</label>
            <select name="rolId" required defaultValue="">
              <option value="" disabled>Selecciona…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label>🏢 Sede</label>
            <select name="sedeId" defaultValue="">
              <option value="">Todas las sedes</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Creando…" : "💾 Guardar usuario"}
        </button>
      </form>
    </details>
  );
}
