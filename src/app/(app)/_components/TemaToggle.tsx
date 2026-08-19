"use client";
// Botón que alterna el tema: automático (el del sistema) → claro → oscuro.
// Persiste en localStorage y fija data-tema en <html>; el CSS hace el resto,
// así que el cambio es instantáneo y sin recargar.
// El valor guardado se aplica antes del primer pintado desde el script de
// src/app/layout.tsx, para que no parpadee.
import { useEffect, useState } from "react";

type Tema = "auto" | "claro" | "oscuro";

const SIGUIENTE: Record<Tema, Tema> = { auto: "claro", claro: "oscuro", oscuro: "auto" };
const ICONO: Record<Tema, string> = { auto: "🌗", claro: "☀️", oscuro: "🌙" };
const TITULO: Record<Tema, string> = {
  auto: "Tema automático (el del sistema) — clic para modo claro",
  claro: "Modo claro — clic para modo oscuro",
  oscuro: "Modo oscuro — clic para volver al automático",
};

function aplicar(t: Tema) {
  const r = document.documentElement;
  if (t === "auto") r.removeAttribute("data-tema");
  else r.setAttribute("data-tema", t);
}

export function TemaToggle() {
  const [tema, setTema] = useState<Tema>("auto");

  useEffect(() => {
    const t = (localStorage.getItem("tema") as Tema) || "auto";
    setTema(t);
    aplicar(t);
  }, []);

  function toggle() {
    const t = SIGUIENTE[tema];
    setTema(t);
    localStorage.setItem("tema", t);
    aplicar(t);
  }

  return (
    <button type="button" onClick={toggle} className="bell" title={TITULO[tema]} aria-label={TITULO[tema]}>
      {ICONO[tema]}
    </button>
  );
}
