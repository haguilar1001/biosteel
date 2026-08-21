"use client";
// ==========================================================
// Menú de configuración de la barra azul (⚙️). Recoge las preferencias que
// antes ocupaban un botón cada una y hacían crecer la barra hasta partir el
// menú en dos líneas: tema, formato de cifras y el acceso a notificaciones.
//
// Ambas preferencias son de NAVEGADOR, no de usuario: viven en localStorage y
// se aplican fijando un atributo en <html>, así que el cambio es instantáneo
// y sin recargar. El tema guardado se aplica antes del primer pintado desde
// el script de src/app/layout.tsx, para que no parpadee.
// ==========================================================
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Tema = "auto" | "claro" | "oscuro";
type Montos = "completo" | "resumido";

const TEMAS: { v: Tema; icono: string; label: string }[] = [
  { v: "auto", icono: "🌗", label: "Automático" },
  { v: "claro", icono: "☀️", label: "Claro" },
  { v: "oscuro", icono: "🌙", label: "Oscuro" },
];

const MONTOS: { v: Montos; label: string; ejemplo: string }[] = [
  { v: "completo", label: "Completas", ejemplo: "$ 223.456.789" },
  { v: "resumido", label: "Resumidas", ejemplo: "$ 223,46 M" },
];

function aplicarTema(t: Tema) {
  const r = document.documentElement;
  if (t === "auto") r.removeAttribute("data-tema");
  else r.setAttribute("data-tema", t);
}

export function ConfigMenu({ verNotificaciones }: { verNotificaciones: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [tema, setTema] = useState<Tema>("auto");
  const [montos, setMontos] = useState<Montos>("completo");
  const ref = useRef<HTMLDivElement>(null);

  // Lee lo guardado y lo aplica al montar (el server no conoce localStorage).
  useEffect(() => {
    const t = (localStorage.getItem("tema") as Tema) || "auto";
    const m = (localStorage.getItem("montos") as Montos) || "completo";
    setTema(t); aplicarTema(t);
    setMontos(m); document.documentElement.dataset.montos = m;
  }, []);

  // Cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);

  function elegirTema(t: Tema) {
    setTema(t); localStorage.setItem("tema", t); aplicarTema(t);
  }
  function elegirMontos(m: Montos) {
    setMontos(m); localStorage.setItem("montos", m); document.documentElement.dataset.montos = m;
  }

  return (
    <div className="cfg-wrap" ref={ref}>
      <button
        type="button"
        className={`icon-btn${abierto ? " abierto" : ""}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Configuración"
        aria-label="Configuración"
        onClick={() => setAbierto(!abierto)}
      >
        ⚙️
      </button>

      {abierto && (
        <div className="cfg-menu" role="menu" aria-label="Configuración">
          <div className="cfg-sec">
            <div className="cfg-titulo">Aspecto</div>
            <div className="cfg-ops">
              {TEMAS.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  role="menuitemradio"
                  aria-checked={tema === t.v}
                  className={`cfg-op${tema === t.v ? " on" : ""}`}
                  onClick={() => elegirTema(t.v)}
                >
                  <span aria-hidden>{t.icono}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cfg-sec">
            <div className="cfg-titulo">Cifras</div>
            <div className="cfg-ops">
              {MONTOS.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  role="menuitemradio"
                  aria-checked={montos === m.v}
                  className={`cfg-op${montos === m.v ? " on" : ""}`}
                  onClick={() => elegirMontos(m.v)}
                  title={m.ejemplo}
                >
                  {m.label} <span className="cfg-ej">{m.ejemplo}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="cfg-sec">
            {verNotificaciones && (
              <Link href="/notificaciones" role="menuitem" className="cfg-link" onClick={() => setAbierto(false)}>
                🔔 Notificaciones
              </Link>
            )}
            <Link href="/cambiar-clave" role="menuitem" className="cfg-link" onClick={() => setAbierto(false)}>
              🔑 Cambiar contraseña
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
