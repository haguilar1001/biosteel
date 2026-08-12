"use client";
// Botón que alterna montos completos ($ 223.456.789) / resumidos ($ 223,46 M).
// Persiste en localStorage y fija data-montos en <html> (toggle instantáneo).
import { useEffect, useState } from "react";

type Modo = "completo" | "resumido";

export function MontosToggle() {
  const [modo, setModo] = useState<Modo>("completo");

  useEffect(() => {
    const m = (localStorage.getItem("montos") as Modo) || "completo";
    setModo(m);
    document.documentElement.dataset.montos = m;
  }, []);

  function toggle() {
    const m: Modo = modo === "resumido" ? "completo" : "resumido";
    setModo(m);
    localStorage.setItem("montos", m);
    document.documentElement.dataset.montos = m;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="bell"
      title={modo === "resumido" ? "Montos resumidos ($ 223 M) — clic para completos" : "Montos completos ($ 223.456.789) — clic para resumidos"}
      aria-label="Alternar montos completos o resumidos"
    >
      {modo === "resumido" ? "$M" : "$0"}
    </button>
  );
}
