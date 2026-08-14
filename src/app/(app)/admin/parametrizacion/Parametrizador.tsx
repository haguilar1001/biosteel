"use client";
// Selector global de fuente y tamaño. Aplica el cambio a TODA la app
// escribiendo variables CSS en <html> y persistiéndolo en localStorage
// (una preferencia por navegador/dispositivo). Sin recarga, un solo clic.
import { useEffect, useState } from "react";

const K_FONT = "ui.font";
const K_ZOOM = "ui.zoom";

// 10 fuentes disponibles de fábrica en Windows (no requieren internet).
// El valor es la pila CSS completa, con familia genérica de respaldo.
interface Fuente { id: string; nombre: string; nota: string; stack: string | null; }
const FUENTES: Fuente[] = [
  { id: "default", nombre: "Predeterminada", nota: "Segoe UI · la actual",   stack: null },
  { id: "calibri", nombre: "Calibri",        nota: "Sans · suave",           stack: '"Calibri", "Segoe UI", sans-serif' },
  { id: "corbel",  nombre: "Corbel",         nota: "Sans · elegante",        stack: '"Corbel", "Segoe UI", sans-serif' },
  { id: "verdana", nombre: "Verdana",        nota: "Sans · muy legible",     stack: '"Verdana", "Segoe UI", sans-serif' },
  { id: "tahoma",  nombre: "Tahoma",         nota: "Sans · compacta",        stack: '"Tahoma", "Segoe UI", sans-serif' },
  { id: "trebuc",  nombre: "Trebuchet MS",   nota: "Sans · amable",          stack: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { id: "arial",   nombre: "Arial",          nota: "Sans · neutra",          stack: '"Arial", "Helvetica Neue", sans-serif' },
  { id: "georgia", nombre: "Georgia",        nota: "Serif · clásica",        stack: '"Georgia", "Times New Roman", serif' },
  { id: "cambria", nombre: "Cambria",        nota: "Serif · para pantalla",  stack: '"Cambria", "Georgia", serif' },
  { id: "consolas",nombre: "Consolas",       nota: "Monoespaciada · técnica",stack: '"Consolas", "Cascadia Mono", monospace' },
  { id: "emoji",   nombre: "Segoe UI Emoji", nota: "Emojis a color",         stack: '"Segoe UI Emoji", "Segoe UI", sans-serif' },
];

// Niveles de tamaño (zoom global). "1" = tamaño de diseño original.
interface Tamano { id: string; nombre: string; zoom: string; }
const TAMANOS: Tamano[] = [
  { id: "s",  nombre: "Compacto",      zoom: "0.9" },
  { id: "m",  nombre: "Normal",        zoom: "1" },
  { id: "l",  nombre: "Cómodo",        zoom: "1.1" },
  { id: "xl", nombre: "Grande",        zoom: "1.2" },
  { id: "xxl",nombre: "Extra grande",  zoom: "1.35" },
];

export function Parametrizador() {
  const [fontId, setFontId] = useState("default");
  const [zoom, setZoom] = useState("1");

  // Lee lo guardado al montar (evita desajuste con el render del servidor).
  useEffect(() => {
    try {
      const f = localStorage.getItem(K_FONT);
      const z = localStorage.getItem(K_ZOOM);
      const match = FUENTES.find((x) => x.stack === f);
      setFontId(f && match ? match.id : "default");
      if (z && TAMANOS.some((t) => t.zoom === z)) setZoom(z);
    } catch { /* localStorage no disponible */ }
  }, []);

  function aplicarFuente(f: Fuente) {
    setFontId(f.id);
    const root = document.documentElement;
    try {
      if (f.stack) {
        root.style.setProperty("--app-font", f.stack);
        localStorage.setItem(K_FONT, f.stack);
      } else {
        root.style.removeProperty("--app-font");
        localStorage.removeItem(K_FONT);
      }
    } catch { /* noop */ }
  }

  function aplicarTamano(t: Tamano) {
    setZoom(t.zoom);
    const root = document.documentElement;
    try {
      root.style.setProperty("--app-zoom", t.zoom);
      localStorage.setItem(K_ZOOM, t.zoom);
    } catch { /* noop */ }
  }

  function restablecer() {
    aplicarFuente(FUENTES[0]!);
    aplicarTamano(TAMANOS[1]!);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* ---- Fuente ---- */}
      <div className="card">
        <div className="chart-head">
          🔤 Fuente de la aplicación
          <span className="hact">se aplica a todas las pantallas</span>
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {FUENTES.map((f) => {
              const activo = f.id === fontId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => aplicarFuente(f)}
                  aria-pressed={activo}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "12px 14px",
                    borderRadius: "var(--r-sm)",
                    border: `1.5px solid ${activo ? "var(--brand)" : "var(--line)"}`,
                    background: activo ? "var(--brand-tint)" : "var(--surface)",
                    boxShadow: activo ? "0 0 0 3px color-mix(in srgb, var(--brand) 15%, transparent)" : "none",
                    fontFamily: f.stack ?? "var(--sans)",
                  }}
                >
                  <div style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
                    {f.nombre}
                  </div>
                  <div style={{ fontSize: 15, color: "var(--ink)", opacity: 0.85, marginTop: 2 }}>
                    AaBbCc 1234 $ áé
                  </div>
                  <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--muted)", marginTop: 6, fontWeight: 600 }}>
                    {activo ? "● Activa" : f.nota}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- Tamaño ---- */}
      <div className="card">
        <div className="chart-head">
          🔎 Tamaño de la interfaz
          <span className="hact">escala toda la app</span>
        </div>
        <div style={{ padding: 14 }}>
          <div className="toolbar">
            {TAMANOS.map((t) => {
              const activo = t.zoom === zoom;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={activo ? "btn primary" : "btn"}
                  onClick={() => aplicarTamano(t)}
                  aria-pressed={activo}
                >
                  {t.nombre}
                </button>
              );
            })}
          </div>
          <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 12.5 }}>
            El tamaño escala todo por igual (texto, tablas, gráficas e iconos).
          </p>
        </div>
      </div>

      {/* ---- Vista previa + acciones ---- */}
      <div className="card">
        <div className="chart-head">👁️ Vista previa</div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>APP Bio Steel</div>
            <div style={{ fontSize: 14, color: "var(--ink)" }}>
              El zorro veloz salta sobre el perro perezoso mientras revisa la cartera del cliente #1.234.
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Venta neta $ 1.234.567.890 · Recaudo 78,4 % · Vencido 12 días
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={restablecer}>↺ Restablecer valores por defecto</button>
          </div>
          <p className="hint" style={{ textAlign: "left", marginTop: 10 }}>
            La preferencia se guarda en este navegador. Cada usuario puede elegir la suya.
          </p>
        </div>
      </div>
    </div>
  );
}
