"use client";
import { useActionState } from "react";
import { guardarConfigAction, type ConfigState } from "./actions";

interface Props {
  diasAntes: number;
  destinatariosRaw: string;
  puedeEditar: boolean;
}

const estiloCampo: React.CSSProperties = {
  border: "1px solid var(--line)",
  background: "var(--canvas)",
  color: "var(--ink)",
  borderRadius: "var(--r-sm)",
  padding: "11px 13px",
  fontSize: 15,
  fontFamily: "inherit",
};

export function ConfigForm({ diasAntes, destinatariosRaw, puedeEditar }: Props) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(guardarConfigAction, {});

  if (!puedeEditar) {
    return (
      <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13 }}>
        Solo un administrador (permiso <code>parametro.manage</code>) puede editar esta configuración.
      </p>
    );
  }

  return (
    <form action={action} className="form-crear" style={{ marginTop: 12 }}>
      {state.ok && <div className="alert ok" role="status">✅ Configuración guardada.</div>}
      {state.error && <div className="alert" role="alert">⚠️ {state.error}</div>}
      <div className="form-grid">
        <div className="field">
          <label>📆 Días de anticipación</label>
          <input type="number" name="diasAntes" defaultValue={diasAntes} min={1} max={120} required style={{ maxWidth: 140 }} />
          <small className="flag">Cuántos días antes del vencimiento se envía el recordatorio.</small>
        </div>
        <div className="field">
          <label>✉️ Destinatarios</label>
          <textarea
            name="destinatarios"
            defaultValue={destinatariosRaw.split(",").join("\n")}
            rows={3}
            required
            style={{ ...estiloCampo, resize: "vertical" }}
          />
          <small className="flag">Un correo por línea (o separados por coma).</small>
        </div>
      </div>
      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Guardando…" : "💾 Guardar configuración"}
      </button>
    </form>
  );
}
