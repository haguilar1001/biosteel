"use client";
// ==========================================================
// Barras comparativas por categoría: dos series (A vs B) por fila, en formato
// compacto. Barras pegadas, valores a la derecha y un % (B/A) con semáforo.
// Cliente para el control +/− (Top N). Formateo local (sin @/lib/format
// para no arrastrar Prisma al bundle). Reutilizable: facturado vs pagado,
// ventas vs recaudos, etc.
// ==========================================================
import { useState } from "react";

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const cop = (v: number) => `$ ${nf.format(Math.round(v))}`;

export interface BarraItem {
  label: string;
  a: number; // serie A (p.ej. facturado / ventas)
  b: number; // serie B (p.ej. pagado / recaudos)
}

// Semáforo del % = B / A (cobertura): verde si B cubre A, ámbar medio, rojo bajo.
function semaforo(a: number, b: number): { txt: string; clase: string } {
  if (a <= 0) return { txt: b > 0 ? "s/A" : "—", clase: "t-blue" };
  const p = (b / a) * 100;
  const clase = p >= 90 ? "t-ok" : p >= 50 ? "t-w1" : "t-bad";
  return { txt: `${Math.round(p)}%`, clase };
}

export function BarrasComparativas({
  items,
  titulo,
  labelA,
  labelB,
  colorA = "var(--cat-1)",
  colorB = "var(--cat-3)",
  step = 5,
  inicial = 12,
}: {
  items: BarraItem[];
  titulo: string;
  labelA: string;
  labelB: string;
  colorA?: string;
  colorB?: string;
  step?: number;
  inicial?: number;
}) {
  const [n, setN] = useState(Math.min(inicial, items.length || inicial));
  const top = items.slice(0, n);
  const max = Math.max(1, ...top.map((t) => Math.max(Math.abs(t.a), Math.abs(t.b))));

  const barra = (v: number, color: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="rank-bar" style={{ flex: 1, height: 7 }}>
        <div style={{ width: `${Math.max(v > 0 ? 2 : 0, (Math.abs(v) / max) * 100)}%`, height: "100%", background: color }} />
      </div>
      <span className="num" style={{ fontSize: 11.5, minWidth: 104, textAlign: "right", color, fontWeight: 700 }}>{cop(v)}</span>
    </div>
  );

  return (
    <div className="card">
      <div className="chart-head">
        {titulo}
        <span className="topn-ctl">
          <button type="button" onClick={() => setN((v) => Math.max(step, v - step))} disabled={n <= step} aria-label="Ver menos">−</button>
          <span className="topn-n">Top {n}</span>
          <button type="button" onClick={() => setN((v) => Math.min(items.length, v + step))} disabled={n >= items.length} aria-label="Ver más">+</button>
        </span>
      </div>
      <div className="card-body">
        <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 11, height: 11, borderRadius: 3, background: colorA }} /> {labelA}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 11, height: 11, borderRadius: 3, background: colorB }} /> {labelB}
          </span>
          <span className="flag" style={{ marginLeft: "auto" }}>% = {labelB} ÷ {labelA}</span>
        </div>
        {top.length === 0 ? (
          <div className="empty">Sin datos.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {top.map((t, idx) => {
              const s = semaforo(t.a, t.b);
              return (
                <div key={`${t.label}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="rank-pos" style={{ alignSelf: "center" }}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span className="rank-label" title={t.label} style={{ fontSize: 12.5 }}>{t.label}</span>
                      <span className={`tag ${s.clase}`} style={{ flex: "0 0 auto" }}>{s.txt}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {barra(t.a, colorA)}
                      {barra(t.b, colorB)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
