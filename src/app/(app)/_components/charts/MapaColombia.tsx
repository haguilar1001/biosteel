// Mapa de Colombia (silueta estilizada) con burbujas por ciudad, tamaño
// proporcional al valor. Server-rendered SVG con tooltip nativo.
import { formatCOP } from "@/lib/format";

// Coordenadas aproximadas en el viewBox 0..100 x 0..130.
const COORD: Record<string, [number, number]> = {
  "Santa Marta": [51, 16],
  "Barranquilla": [45, 19],
  "Cartagena": [38, 22],
  "Sincelejo": [41, 29],
  "Montería": [36, 31],
  "Medellín": [37, 45],
  "Bogotá": [49, 58],
  "Cali": [29, 71],
  "Cúcuta": [60, 33],
  "Bucaramanga": [52, 42],
};

const COLOMBIA =
  "M40,18 C33,14 28,16 26,22 C24,30 20,34 18,42 C16,52 20,60 24,68 C26,74 28,82 34,88 " +
  "C40,94 44,101 46,110 C48,116 52,120 54,116 C58,108 61,98 64,88 C70,78 76,66 76,54 " +
  "C76,44 72,36 66,30 C60,24 54,16 50,14 C46,12 43,14 40,18 Z";

export interface BurbujaCiudad {
  ciudad: string;
  valor: number;
  color: string;
}

export function MapaColombia({ data, size = 300 }: { data: BurbujaCiudad[]; size?: number }) {
  const conCoord = data.filter((d) => COORD[d.ciudad] && d.valor > 0);
  const max = Math.max(1, ...conCoord.map((d) => Math.abs(d.valor)));
  const rMax = 13, rMin = 4.5;
  const radio = (v: number) => rMin + (Math.sqrt(Math.abs(v)) / Math.sqrt(max)) * (rMax - rMin);

  return (
    <svg viewBox="0 0 100 130" width={size * 0.77} height={size} style={{ maxWidth: "100%" }}>
      <path d={COLOMBIA} fill="var(--brand-tint)" stroke="var(--brand-soft)" strokeWidth={0.6} />
      {conCoord
        .slice()
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
        .map((d) => {
          const [x, y] = COORD[d.ciudad]!;
          const r = radio(d.valor);
          return (
            <g key={d.ciudad}>
              <circle cx={x} cy={y} r={r} fill={d.color} fillOpacity={0.82} stroke="var(--surface)" strokeWidth={0.8}>
                <title>{`${d.ciudad}: ${formatCOP(d.valor)}`}</title>
              </circle>
              <text x={x} y={y - r - 1.5} textAnchor="middle" fontSize={3.4} fontWeight={700} fill="var(--ink)">{d.ciudad}</text>
            </g>
          );
        })}
    </svg>
  );
}
