"use client";
// Botón para enviar el correo de bienvenida a todos los usuarios activos.
import { useState, useTransition } from "react";
import { enviarBienvenidaTodosAction, type AdminState } from "../actions";

export function EnviarBienvenidaBtn({ total }: { total: number }) {
  const [pending, startTransition] = useTransition();
  const [res, setRes] = useState<AdminState | null>(null);

  const enviar = () => {
    if (!window.confirm(`¿Enviar el correo de bienvenida a los ${total} usuarios activos? Recibirán un correo real.`)) return;
    setRes(null);
    startTransition(async () => setRes(await enviarBienvenidaTodosAction()));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button type="button" className="btn" onClick={enviar} disabled={pending} title="Envía el correo de bienvenida a todos los usuarios activos">
        {pending ? "Enviando…" : "✉️ Enviar bienvenida a todos"}
      </button>
      {res?.ok && <span className="tag t-ok" role="status">{res.msg}</span>}
      {res?.error && <span className="tag t-bad" role="alert">{res.error}</span>}
    </div>
  );
}
