"use client";
// Campo de contraseña con botón de "ojo" para mostrar/ocultar el texto.
// Reutilizable en login, creación de usuarios y cambio de contraseña.
import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ style, ...props }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex" }}>
      <input
        {...props}
        type={show ? "text" : "password"}
        style={{ ...style, flex: 1, width: "100%", paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={show}
        title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        tabIndex={-1}
        style={{
          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", padding: 6,
          color: "var(--muted)", display: "grid", placeItems: "center", lineHeight: 0,
        }}
      >
        {show ? <IconoOjoTachado /> : <IconoOjo />}
      </button>
    </div>
  );
}

function IconoOjo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconoOjoTachado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
