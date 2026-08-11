"use client";
// ==========================================================
// Selector con opción de crear un valor nuevo.
// Muestra un <select> con las opciones existentes + "➕ Crear nuevo…";
// al elegir esa opción, cambia a un campo de texto para escribir el valor.
// Envía el valor por un input oculto name={name} (para el submit del form).
// ==========================================================
import { useState } from "react";

interface Props {
  name: string;
  opciones: string[];
  value?: string;                 // controlado (opcional)
  onValueChange?: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  crearLabel?: string;            // texto de la opción "crear"
}

export function SelectOCrear({ name, opciones, value, onValueChange, placeholder = "Escribe el nuevo valor…", required, crearLabel = "➕ Crear nuevo…" }: Props) {
  const controlado = value !== undefined;
  const [interno, setInterno] = useState(value ?? "");
  const val = controlado ? value! : interno;
  const [crear, setCrear] = useState<boolean>(() => !!val && !opciones.includes(val));

  const set = (v: string) => { if (!controlado) setInterno(v); onValueChange?.(v); };

  return (
    <>
      <input type="hidden" name={name} value={val} />
      {crear ? (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            className="select" style={{ flex: 1 }} autoFocus placeholder={placeholder} required={required}
            value={val} onChange={(e) => set(e.target.value)}
          />
          <button type="button" className="btn" title="Elegir de la lista" onClick={() => { setCrear(false); set(""); }}>↩</button>
        </div>
      ) : (
        <select
          className="select" required={required} value={opciones.includes(val) ? val : ""}
          onChange={(e) => {
            if (e.target.value === "__crear__") { setCrear(true); set(""); }
            else set(e.target.value);
          }}
        >
          <option value="" disabled>Selecciona…</option>
          {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value="__crear__">{crearLabel}</option>
        </select>
      )}
    </>
  );
}
