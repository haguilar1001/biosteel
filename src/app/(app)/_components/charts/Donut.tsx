// Anillo (donut) SVG server-rendered. Color categórico + leyenda + total al centro.
// Tooltip nativo por segmento (<title>). 2px de separación entre segmentos.
import { formatCOP, formatPorcentaje } from "@/lib/format";

export interface SegmentoDonut {
  label: string;
  valor: number;
  color: string; // p.ej. "var(--cat-1)"
}

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

export function Donut({
  data,
  centro,
  size = 300,
  legend = true,
}: {
  data: SegmentoDonut[];
  centro?: { valor: string; etiqueta: string };
  size?: number;
  legend?: boolean;
}) {
  const total = data.reduce((s, d) => s + Math.abs(d.valor), 0) || 1;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4, ir = r * 0.62;
  let ang = 0;
  const gap = 2; // grados de separación

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ maxWidth: "100%", flex: "0 0 auto" }}>
        {data.map((d) => {
          const frac = Math.abs(d.valor) / total;
          const s = ang + gap / 2;
          const e = ang + frac * 360 - gap / 2;
          ang += frac * 360;
          if (e <= s) return null;
          return (
            <path key={d.label} d={arco(cx, cy, r, ir, s, e)} fill={d.color}>
              <title>{`${d.label}: ${formatCOP(d.valor)} (${formatPorcentaje(frac * 100)})`}</title>
            </path>
          );
        })}
        {centro && (
          <>
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size * 0.11} fontWeight="800" fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>{centro.valor}</text>
            <text x={cx} y={cy + size * 0.1} textAnchor="middle" fontSize={size * 0.06} fill="var(--muted)">{centro.etiqueta}</text>
          </>
        )}
      </svg>
      <div style={{ width: "100%", display: legend ? "flex" : "none", flexDirection: "column", gap: 2 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 4px", borderTop: "1px solid var(--line)" }}>
            <i style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flex: "0 0 auto" }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span className="num" style={{ fontWeight: 700 }}>{formatCOP(d.valor)}</span>
            <span className="num" style={{ color: "var(--muted)", minWidth: 58, textAlign: "right" }}>{formatPorcentaje((Math.abs(d.valor) / total) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
