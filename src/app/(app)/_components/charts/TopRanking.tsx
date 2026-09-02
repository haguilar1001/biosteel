"use client";
// ==========================================================
// Ranking horizontal "Top N" con botones +/− para variar cuántos se ven.
// Cliente para que el +/− sea instantáneo (los datos ya vienen cargados).
// Formateo local (no importa @/lib/format para no arrastrar Prisma al bundle).
// ==========================================================
import { useState } from "react";

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const cop = (v: number) => `$ ${nf.format(Math.round(v))}`;

export interface RankItem {
  label: string;
  valor: number;
  sub?: string;
}

export function TopRanking({
  items,
  titulo,
  color = "var(--brand)",
  step = 5,
  inicial = 10,
  formato = cop,
}: {
  items: RankItem[];
  titulo: string;
  color?: string;
  step?: number;
  inicial?: number;
  /** Cómo se escribe el valor. Por defecto pesos; los rankings que no son de plata pasan el suyo. */
  formato?: (v: number) => string;
}) {
  const [n, setN] = useState(Math.min(inicial, items.length || inicial));
  const top = items.slice(0, n);
  const max = Math.max(1, ...top.map((t) => Math.abs(t.valor)));

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
        {top.length === 0 ? (
          <div className="empty">Sin datos.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top.map((t, idx) => (
              <div key={`${t.label}-${idx}`} className="rank-row">
                <span className="rank-pos">{idx + 1}</span>
                <div className="rank-main">
                  <div className="rank-top">
                    <span className="rank-label" title={t.label}>
                      {t.label}
                      {t.sub && <span className="flag" style={{ marginLeft: 8, fontWeight: 600 }}>· {t.sub}</span>}
                    </span>
                    <span className="rank-val num">{formato(t.valor)}</span>
                  </div>
                  <div className="rank-bar">
                    <div style={{ width: `${Math.max(2, (Math.abs(t.valor) / max) * 100)}%`, background: color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
