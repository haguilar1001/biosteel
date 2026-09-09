"use client";
// ==========================================================
// Selector de opción múltiple con búsqueda, para filtros GET dentro de un
// <FiltroAuto>: el botón abre un panel con checkboxes; "Aplicar" lo cierra y
// dispara el submit del formulario contenedor (mismo mecanismo que un
// <select> normal). El valor viaja en un <input type="hidden"> con los
// valores unidos por coma, igual que ya hace el resto de la app con `meses`.
//
// Cerrar sin aplicar (clic afuera o Escape) descarta la selección a medias:
// solo "Aplicar" confirma, para que marcar varias casillas no dispare un
// envío por cada clic.
// ==========================================================
import { useEffect, useRef, useState } from "react";

export interface OpcionMulti { value: string; label: string; sub?: string }

export function MultiSelect({
  name, options, selected, placeholder = "Todos", ancho = 260,
}: {
  name: string;
  options: OpcionMulti[];
  /** Valores ya elegidos (desde la URL), como llegan del server. */
  selected: string[];
  placeholder?: string;
  ancho?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, setPendiente] = useState<Set<string>>(new Set(selected));
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Si la URL cambió por fuera (otro filtro, navegación), el pendiente se
  // resincroniza con lo ya aplicado.
  useEffect(() => { setPendiente(new Set(selected)); }, [selected.join(",")]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setPendiente(new Set(selected)); setAbierto(false); }
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setPendiente(new Set(selected)); setAbierto(false); } };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto, selected]);

  const q = busqueda.trim().toLowerCase();
  const visibles = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  const toggle = (v: string) => setPendiente((prev) => {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  });

  const aplicar = () => {
    setAbierto(false);
    // Directo, sin requestAnimationFrame: cada casilla ya actualizó el
    // estado (y por tanto el hidden input) en su propio evento, antes de
    // que este clic siquiera ocurriera, así que no hay nada que esperar. Un
    // rAF aquí se queda colgado si la pestaña no está en primer plano — el
    // navegador pausa los callbacks de rAF en pestañas de fondo — y "Aplicar"
    // dejaba de disparar el envío sin ningún error visible.
    //
    // El <form> es ANCESTRO de este componente, no descendiente: closest()
    // sube por el árbol; querySelector() solo baja y nunca lo habría encontrado.
    ref.current?.closest("form")?.requestSubmit();
  };

  const resumen = selected.length === 0 ? placeholder
    : selected.length === 1 ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
    : `${selected.length} seleccionados`;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <input type="hidden" name={name} value={[...pendiente].join(",")} />
      <button
        type="button"
        className="select"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 120, maxWidth: ancho, textAlign: "left", cursor: "pointer" }}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{resumen}</span>
        <span aria-hidden style={{ opacity: 0.6 }}>▾</span>
      </button>

      {abierto && (
        <div
          role="listbox"
          style={{
            position: "absolute", zIndex: 40, top: "calc(100% + 4px)", left: 0, width: Math.max(ancho, 240),
            background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
            boxShadow: "var(--elev, 0 4px 16px rgba(0,0,0,.15))", padding: 8, display: "flex", flexDirection: "column", gap: 6,
          }}
        >
          {options.length > 6 && (
            <input
              type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…" className="select" style={{ width: "100%" }}
              autoFocus
            />
          )}
          <div style={{ display: "flex", gap: 8, fontSize: 11.5 }}>
            <button type="button" className="flag" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--brand)" }}
              onClick={() => setPendiente(new Set(visibles.map((o) => o.value)))}>
              Marcar {q ? "visibles" : "todos"}
            </button>
            <button type="button" className="flag" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--brand)" }}
              onClick={() => setPendiente(new Set())}>
              Limpiar
            </button>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {visibles.length === 0 ? (
              <div className="flag" style={{ padding: "6px 4px" }}>Sin resultados.</div>
            ) : visibles.map((o) => (
              <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px", fontSize: 12.5, cursor: "pointer", borderRadius: 4 }}>
                <input type="checkbox" checked={pendiente.has(o.value)} onChange={() => toggle(o.value)} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                {o.sub && <span className="flag" style={{ marginLeft: "auto", fontSize: 11 }}>{o.sub}</span>}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
            <button type="button" className="btn" onClick={() => { setPendiente(new Set(selected)); setAbierto(false); }}>Cancelar</button>
            <button type="button" className="btn primary" onClick={aplicar}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}
