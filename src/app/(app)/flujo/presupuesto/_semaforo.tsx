// Semáforos de cumplimiento presupuestal (formato condicional), compartidos por
// las vistas "Ppto vs Real Ingresos" y "Ppto vs Real Egresos".
import { formatPorcentaje } from "@/lib/format";

// Presupuesto de ingresos: meta fija de $2.000 millones por mes (2026).
export const PRESUPUESTO_INGRESO_MES = 2_000_000_000;

/**
 * INGRESOS (más es mejor):
 *  ≥100% cumplió/superó (verde) · 85–100% cerca (ámbar) · <85% por debajo (rojo).
 */
export function CeldaIngreso({ presupuesto, real }: { presupuesto: number; real: number }) {
  if (presupuesto <= 0) return <span className="flag">—</span>;
  const pct = (real / presupuesto) * 100;
  const { clase, icon } = pct >= 100
    ? { clase: "t-ok", icon: "✓" }
    : pct >= 85
      ? { clase: "t-w1", icon: "▲" }
      : { clase: "t-bad", icon: "✗" };
  return <span className={`tag ${clase}`}>{icon} {formatPorcentaje(pct)}</span>;
}

/**
 * EGRESOS (menos es mejor):
 *  ≤100% dentro/por debajo (verde) · 100–110% leve sobre (ámbar) ·
 *  110–150% sobreejecutado (rojo) · ≥150% grave (⚠️) · sin presupuesto (⚠️).
 */
export function CeldaEgreso({ presupuesto, real }: { presupuesto: number; real: number }) {
  if (presupuesto <= 0) {
    if (real > 0) return <span className="tag t-bad" title="Egreso ejecutado sin presupuesto asignado">⚠️ Sin presup.</span>;
    return <span className="flag">—</span>;
  }
  const pct = (real / presupuesto) * 100;
  const { clase, icon, alerta } = pct >= 150
    ? { clase: "t-bad", icon: "⚠️", alerta: true }
    : pct > 110
      ? { clase: "t-bad", icon: "✗", alerta: false }
      : pct > 100
        ? { clase: "t-w1", icon: "▲", alerta: false }
        : { clase: "t-ok", icon: "✓", alerta: false };
  return <span className={`tag ${clase}`} title={alerta ? "Sobreejecución ≥150% del presupuesto" : undefined}>{icon} {formatPorcentaje(pct)}</span>;
}
