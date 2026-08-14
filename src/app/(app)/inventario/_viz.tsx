// ==========================================================
// Visuales del módulo Inventarios (server-rendered, sin estado).
// Donut de conteos y barras apiladas por categoría — SVG puro, tooltips
// nativos <title>, misma paleta que el resto de la app.
// ==========================================================
import { formatNumero, formatPorcentaje } from "@/lib/format";

export interface Segmento { label: string; valor: number; color: string; }

/** Color por estado (coherente con los badges t-ok/t-w1/t-bad/t-blue). */
export const ESTADO_COLOR: Record<string, string> = {
  activo: "var(--ok)", en_reparacion: "var(--w1)", de_baja: "var(--bad)", pendiente: "var(--brand)",
};
/** Paleta azul para categorías/marcas. */
const PALETA = ["var(--az-1)", "var(--az-2)", "var(--az-3)", "var(--az-4)", "var(--az-5)", "var(--az-6)", "var(--az-7)", "var(--az-8)"];
export function colorPaleta(i: number): string { return PALETA[i % PALETA.length]!; }

function polar(cx: number, cy: number, r: number, ang: number): [number, number] {
  const a = ((ang - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arco(cx: number, cy: number, r: number, ir: number, s: number, e: number): string {
  const [x1, y1] = polar(cx, cy, r, s), [x2, y2] = polar(cx, cy, r, e);
  const [x3, y3] = polar(cx, cy, ir, e), [x4, y4] = polar(cx, cy, ir, s);
  const large = e - s > 180 ? 1 : 0;
  return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${ir} ${ir} 0 ${large} 0 ${x4} ${y4} Z`;
}

/** Donut de conteos con leyenda (valor entero + %). */
export function DonutConteo({
  data, centro, size = 260,
}: {
  data: Segmento[];
  centro?: { valor: string; etiqueta: string };
  size?: number;
}) {
  const segs = data.filter((d) => d.valor > 0);
  const total = segs.reduce((s, d) => s + d.valor, 0) || 1;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4, ir = r * 0.62, gap = 2;

  let ang = 0;
  const arcos = segs.map((d) => {
    const frac = d.valor / total;
    const s = ang + gap / 2;
    const e = ang + frac * 360 - gap / 2;
    ang += frac * 360;
    return { d, s, e };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", padding: 16, width: "100%" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ maxWidth: "100%" }}>
        {arcos.map(({ d, s, e }) =>
          e <= s ? null : (
            <path key={d.label} d={arco(cx, cy, r, ir, s, e)} fill={d.color} stroke="var(--surface)" strokeWidth={1}>
              <title>{d.label}: {formatNumero(d.valor)} ({formatPorcentaje((d.valor / total) * 100)})</title>
            </path>
          ),
        )}
        {centro && (
          <>
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size * 0.16} fontWeight="800" fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>{centro.valor}</text>
            <text x={cx} y={cy + size * 0.11} textAnchor="middle" fontSize={size * 0.07} fill="var(--muted)">{centro.etiqueta}</text>
          </>
        )}
      </svg>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
        {segs.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 8px", borderTop: "1px solid var(--line)" }}>
            <i style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flex: "0 0 auto" }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span className="num" style={{ fontWeight: 700 }}>{formatNumero(d.valor)}</span>
            <span className="num" style={{ color: "var(--muted)", minWidth: 52, textAlign: "right" }}>{formatPorcentaje((d.valor / total) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface FilaBarra {
  label: string;
  sub?: string;
  total: number;
  partes: Segmento[]; // se apilan de izquierda a derecha
}

/** Barras horizontales apiladas (por ciudad/categoría), con total a la derecha. */
export function BarrasApiladas({ filas, leyenda }: { filas: FilaBarra[]; leyenda?: Segmento[] }) {
  const max = Math.max(1, ...filas.map((f) => f.total));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, width: "100%" }}>
      {leyenda && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {leyenda.map((l) => (
            <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
              <i style={{ width: 11, height: 11, borderRadius: 3, background: l.color }} /> {l.label}
            </span>
          ))}
        </div>
      )}
      {filas.map((f) => (
        <div key={f.label} style={{ display: "grid", gridTemplateColumns: "130px 1fr 54px", alignItems: "center", gap: 10 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</div>
            {f.sub && <div className="flag" style={{ fontSize: 11 }}>{f.sub}</div>}
          </div>
          <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", background: "var(--canvas)", width: `${(f.total / max) * 100}%`, minWidth: 4 }}>
            {f.partes.filter((p) => p.valor > 0).map((p) => (
              <div key={p.label} title={`${p.label}: ${formatNumero(p.valor)}`}
                style={{ width: `${(p.valor / f.total) * 100}%`, background: p.color }} />
            ))}
          </div>
          <div className="num" style={{ fontWeight: 700, textAlign: "right", paddingRight: 6 }}>{formatNumero(f.total)}</div>
        </div>
      ))}
    </div>
  );
}
