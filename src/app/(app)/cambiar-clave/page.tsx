// Cambiar contraseña propia (cualquier usuario autenticado).
"use client";
import { useActionState } from "react";
import { cambiarClaveAction, type CambioState } from "./actions";
import { PasswordInput } from "@/components/PasswordInput";

export default function CambiarClavePage() {
  const [state, formAction, pending] = useActionState<CambioState, FormData>(cambiarClaveAction, {});

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Seguridad</div>
          <h1>Cambiar contraseña</h1>
          <p>Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo. Al cambiarla se cerrarán todas tus sesiones.</p>
        </div>
      </div>

      <form action={formAction} className="card" style={{ maxWidth: 480 }}>
        <div className="chart-head">Datos</div>
        <div className="card-body">
          {state.error && <div className="alert" role="alert">{state.error}</div>}
          <div className="field">
            <label htmlFor="actual">Contraseña actual</label>
            <PasswordInput id="actual" name="actual" autoComplete="current-password" required />
          </div>
          <div className="field">
            <label htmlFor="nueva">Nueva contraseña</label>
            <PasswordInput id="nueva" name="nueva" autoComplete="new-password" required />
          </div>
          <div className="field">
            <label htmlFor="confirmar">Confirmar nueva contraseña</label>
            <PasswordInput id="confirmar" name="confirmar" autoComplete="new-password" required />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <a className="btn" href="/dashboard">Cancelar</a>
            <button type="submit" className="btn primary" disabled={pending}>
              {pending ? "Guardando…" : "Cambiar contraseña"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
