"use client";
// Botón para sincronizar el Flujo de Caja al instante (descarga de OneDrive).
import { useActionState } from "react";
import { sincronizarFlujoAhoraAction, type SyncState } from "./actions";

export function BotonSync() {
  const [state, action, pending] = useActionState(sincronizarFlujoAhoraAction, {} as SyncState);
  return (
    <form action={action} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button className="btn primary" disabled={pending}>{pending ? "Sincronizando…" : "🔄 Sincronizar ahora"}</button>
      {state.ok && <span className="flag" style={{ color: "var(--ok)" }}>✓ {state.mensaje}</span>}
      {state.error && <span className="flag" style={{ color: "var(--bad)" }}>{state.error}</span>}
    </form>
  );
}
