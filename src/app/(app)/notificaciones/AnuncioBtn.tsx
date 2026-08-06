"use client";
import { useActionState } from "react";
import { enviarAnuncioAction, type AnuncioState } from "./actions";

export function AnuncioBtn() {
  const [state, action, pending] = useActionState<AnuncioState, FormData>(
    () => enviarAnuncioAction({}),
    {},
  );
  return (
    <form action={action}>
      <button type="submit" className="btn" disabled={pending} title="Envía un correo de presentación (con el logo) a los destinatarios y a tu propio correo">
        {pending ? "Enviando…" : "✉️ Enviar correo de anuncio"}
      </button>
      {state.error && <span className="flag" style={{ color: "var(--bad)", marginLeft: 10 }}>{state.error}</span>}
      {state.enviado && (
        <span className="flag" style={{ marginLeft: 10 }}>
          Anuncio enviado a {state.destinatarios?.length ?? 0} correo(s) ✓
        </span>
      )}
    </form>
  );
}
