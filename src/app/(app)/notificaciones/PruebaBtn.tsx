"use client";
// Botón TEMPORAL de prueba: envía un correo (con logo) SOLO al usuario de
// sesión, sin tocar a los destinatarios configurados. Para verificar que el
// envío de correo ya funciona. Quitar una vez comprobado.
import { useActionState } from "react";
import { enviarPruebaAction, type AnuncioState } from "./actions";

export function PruebaBtn({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AnuncioState, FormData>(
    () => enviarPruebaAction({}),
    {},
  );
  return (
    <form action={action}>
      <button type="submit" className="btn" disabled={pending} title={`Envía un correo de prueba (con el logo) solo a ${email}`}>
        {pending ? "Enviando…" : "🧪 Enviar prueba solo a mí"}
      </button>
      {state.error && <span className="flag" style={{ color: "var(--bad)", marginLeft: 10 }}>{state.error}</span>}
      {state.enviado && (
        <span className="flag" style={{ marginLeft: 10, color: "var(--ok)" }}>
          Prueba enviada a {state.destinatarios?.[0]} ✓
        </span>
      )}
    </form>
  );
}
