"use client";
import { useActionState } from "react";
import { ejecutarAhoraAction, type EjecutarState } from "./actions";

export function EjecutarBtn() {
  const [state, action, pending] = useActionState<EjecutarState, FormData>(
    () => ejecutarAhoraAction({}),
    {},
  );
  return (
    <form action={action}>
      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Ejecutando…" : "Ejecutar recordatorios ahora"}
      </button>
      {state.error && <span className="flag" style={{ color: "var(--bad)", marginLeft: 10 }}>{state.error}</span>}
      {state.resultado && (
        <span className="flag" style={{ marginLeft: 10 }}>
          {state.resultado.configurado
            ? `Enviadas ${state.resultado.enviadas} · ya estaban ${state.resultado.yaEnviadas} · errores ${state.resultado.errores}`
            : "⚠️ SMTP no configurado — no se envió nada."}
        </span>
      )}
    </form>
  );
}
