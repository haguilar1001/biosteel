"use client";
// ==========================================================
// Barras comparativas por categoría: dos series (A vs B) por fila.
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
  sub?: string;
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
        <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 12, height: 12, borderRadius: 3, background: colorA }} /> {labelA}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 12, height: 12, borderRadius: 3, background: colorB }} /> {labelB}
          </span>
        </div>
        {top.length === 0 ? (
          <div className="empty">Sin datos.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {top.map((t, idx) => (
              <div key={`${t.label}-${idx}`} className="rank-row">
                <span className="rank-pos">{idx + 1}</span>
                <div className="rank-main">
                  <div className="rank-top">
                    <span className="rank-label" title={t.label}>{t.label}</span>
                  </div>
                  {/* Serie A */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div className="rank-bar" style={{ flex: 1 }}>
                      <div style={{ width: `${Math.max(t.a > 0 ? 2 : 0, (Math.abs(t.a) / max) * 100)}%`, background: colorA }} />
                    </div>
                    <span className="num" style={{ fontSize: 12, minWidth: 108, textAlign: "right", color: colorA, fontWeight: 700 }}>{cop(t.a)}</span>
                  </div>
                  {/* Serie B */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="rank-bar" style={{ flex: 1 }}>
                      <div style={{ width: `${Math.max(t.b > 0 ? 2 : 0, (Math.abs(t.b) / max) * 100)}%`, background: colorB }} />
                    </div>
                    <span className="num" style={{ fontSize: 12, minWidth: 108, textAlign: "right", color: colorB, fontWeight: 700 }}>{cop(t.b)}</span>
                  </div>
                  {t.sub && <span className="rank-sub flag">{t.sub}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
