// Medidor (gauge) semicircular SVG server-rendered. Muestra un porcentaje.
import { formatPorcentaje } from "@/lib/format";

export function Medidor({
  valor,
  etiqueta,
  color = "var(--brand)",
  max = 100,
  size = 180,
}: {
  valor: number; // porcentaje (puede superar max)
  etiqueta?: string;
  color?: string;
  max?: number;
  size?: number;
}) {
  const w = size, h = size * 0.62;
  const cx = w / 2, cy = h - 6, r = w / 2 - 12;
  const largo = Math.PI * r; // longitud del semicírculo
  const frac = Math.max(0, Math.min(1, valor / max));
  const semic = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
      <svg viewBox={`0 0 ${w} ${h + 4}`} width={size} height={h + 4}>
        <path d={semic} fill="none" stroke="var(--brand-tint)" strokeWidth={14} strokeLinecap="round" />
        <path
          d={semic} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
          strokeDasharray={`${frac * largo} ${largo}`}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size * 0.16} fontWeight="800" fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatPorcentaje(valor)}
        </text>
      </svg>
      {etiqueta && <div className="flag" style={{ marginTop: -4 }}>{etiqueta}</div>}
    </div>
  );
}
