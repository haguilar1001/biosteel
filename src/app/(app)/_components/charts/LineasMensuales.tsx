// Gráfica de líneas (XY) server-rendered para comparar series por mes
// (p. ej. venta neta 2026 vs 2025). Ejes, grilla, leyenda y puntos.
// Los valores null no se dibujan (permite cortar el año en curso en el mes
// actual, sin que la línea caiga a cero).
export interface SerieLinea {
  label: string;
  color: string;
  data: (number | null)[]; // alineada con `categorias`
  dash?: boolean; // línea punteada (p. ej. para el año anterior)
}

const nf0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

// Curva suave (Catmull-Rom -> Bézier cúbica) que pasa por todos los puntos.
function curvaSuave(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0]![0]},${pts[0]![1]}`;
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function LineasMensuales({
  categorias,
  series,
  height = 280,
  unidad = "millones COP",
  desdeCero = true,
  formatoY,
  formatoPunto,
}: {
  categorias: string[];
  series: SerieLinea[];
  height?: number;
  unidad?: string;
  /** Etiqueta del eje Y. Por defecto convierte pesos a millones. */
  formatoY?: (v: number) => string;
  /** Texto del tooltip de cada punto. Por defecto lo formatea como pesos. */
  formatoPunto?: (v: number) => string;
  /**
   * false = el eje arranca cerca del dato más bajo en vez de en cero. Para
   * series de saldo (un stock que se mueve poco sobre una base grande) un eje
   * desde cero aplasta la línea y no deja ver nada.
   */
  desdeCero?: boolean;
}) {
  const width = 900;
  const padL = 58, padR = 16, padT = 14, padB = 30;
  const n = categorias.length;
  const vals = series.flatMap((s) => s.data.filter((v): v is number => v != null));
  const maxData = Math.max(1, ...vals);
  const minData = Math.min(...vals, maxData);
  const divisiones = 4;

  // Escala con extremos "redondos".
  let min = 0, max: number;
  if (desdeCero || minData <= 0) {
    const paso = Math.pow(10, Math.floor(Math.log10(maxData / divisiones)));
    max = Math.ceil(maxData / paso) * paso;
  } else {
    const rango = Math.max(maxData - minData, maxData * 0.02);
    const paso = Math.pow(10, Math.floor(Math.log10(rango / divisiones)));
    min = Math.floor((minData - rango * 0.25) / paso) * paso;
    max = Math.ceil((maxData + rango * 0.25) / paso) * paso;
  }

  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (width - padL - padR));
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (height - padT - padB);
  const etiquetaY = formatoY ?? ((v: number) => nf0.format(Math.round(v / 1e6)));
  const etiquetaPunto = formatoPunto ?? ((v: number) => `$ ${nf0.format(Math.round(v))}`);

  return (
    <div>
      {/* Leyenda */}
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12.5, flexWrap: "wrap" }}>
        {series.map((s) => (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="18" height="6" style={{ display: "block" }}>
              <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={s.dash ? "4 3" : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
        <span className="flag" style={{ marginLeft: "auto" }}>valores en {unidad}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
        {/* Grilla horizontal + etiquetas Y */}
        {Array.from({ length: divisiones + 1 }, (_, k) => {
          const v = min + ((max - min) / divisiones) * k;
          const yy = y(v);
          return (
            <g key={k}>
              <line x1={padL} y1={yy} x2={width - padR} y2={yy} stroke="var(--line)" strokeWidth={1} />
              <text x={padL - 8} y={yy + 3} textAnchor="end" fontSize={10.5} fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{etiquetaY(v)}</text>
            </g>
          );
        })}

        {/* Etiquetas X (meses) */}
        {categorias.map((c, i) => (
          <text key={c + i} x={x(i)} y={height - padB + 16} textAnchor="middle" fontSize={10.5} fill="var(--muted)">{c}</text>
        ))}

        {/* Series: línea + puntos (ignora null) */}
        {series.map((s) => {
          const coords = s.data
            .map((v, i) => (v == null ? null : ([x(i), y(v)] as [number, number])))
            .filter((c): c is [number, number] => c != null);
          return (
            <g key={s.label}>
              {coords.length > 1 && (
                <path d={curvaSuave(coords)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dash ? "6 5" : undefined} />
              )}
              {s.data.map((v, i) =>
                v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color}><title>{`${categorias[i]}: ${etiquetaPunto(v)}`}</title></circle>,
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
