// Gráfica de líneas (XY) server-rendered para comparar series por mes
// (p. ej. venta neta 2026 vs 2025). Ejes, grilla, leyenda y puntos.
// Los valores null no se dibujan (permite cortar el año en curso en el mes
// actual, sin que la línea caiga a cero).
export interface SerieLinea {
  label: string;
  color: string;
  data: (number | null)[]; // alineada con `categorias`
}

const nf0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export function LineasMensuales({
  categorias,
  series,
  height = 280,
  unidad = "millones COP",
}: {
  categorias: string[];
  series: SerieLinea[];
  height?: number;
  unidad?: string;
}) {
  const width = 900;
  const padL = 58, padR = 16, padT = 14, padB = 30;
  const n = categorias.length;
  const vals = series.flatMap((s) => s.data.filter((v): v is number => v != null));
  const maxData = Math.max(1, ...vals);
  // Máximo "redondo" para la escala (4 divisiones).
  const paso = Math.pow(10, Math.floor(Math.log10(maxData / 4)));
  const max = Math.ceil(maxData / paso) * paso;
  const divisiones = 4;

  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (width - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (height - padT - padB);
  const millY = (v: number) => nf0.format(Math.round(v / 1e6));

  return (
    <div>
      {/* Leyenda */}
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12.5, flexWrap: "wrap" }}>
        {series.map((s) => (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 14, height: 3, borderRadius: 2, background: s.color, display: "inline-block" }} /> {s.label}
          </span>
        ))}
        <span className="flag" style={{ marginLeft: "auto" }}>valores en {unidad}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
        {/* Grilla horizontal + etiquetas Y */}
        {Array.from({ length: divisiones + 1 }, (_, k) => {
          const v = (max / divisiones) * k;
          const yy = y(v);
          return (
            <g key={k}>
              <line x1={padL} y1={yy} x2={width - padR} y2={yy} stroke="var(--line)" strokeWidth={1} />
              <text x={padL - 8} y={yy + 3} textAnchor="end" fontSize={10.5} fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{millY(v)}</text>
            </g>
          );
        })}

        {/* Etiquetas X (meses) */}
        {categorias.map((c, i) => (
          <text key={c + i} x={x(i)} y={height - padB + 16} textAnchor="middle" fontSize={10.5} fill="var(--muted)">{c}</text>
        ))}

        {/* Series: línea + puntos (ignora null) */}
        {series.map((s) => {
          const pts = s.data
            .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
            .filter((p): p is string => p != null);
          return (
            <g key={s.label}>
              {pts.length > 1 && (
                <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {s.data.map((v, i) =>
                v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color}><title>{`${categorias[i]}: $ ${nf0.format(Math.round(v))}`}</title></circle>,
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
