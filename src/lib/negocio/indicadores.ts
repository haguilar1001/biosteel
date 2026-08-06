// ==========================================================
// Indicadores financieros (Contabilidad). Calcula lo posible con los
// datos cargados; marca "pendiente" lo que requiere datos aún no cargados.
// Los proxies quedan etiquetados en `nota`.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import type { UsuarioConRol } from "@/lib/auth/session";
import type { Alcance } from "@/lib/rbac/permissions";
import { flujoMensual } from "./flujo";
import { resumenCartera } from "./cartera";
import { resumenCxp } from "./cxp";

export type Unidad = "cop" | "dias" | "pct" | "veces";

export interface Indicador {
  num: number;
  nombre: string;
  formula: string;
  metaTexto: string;
  frecuencia: string;
  real: number | null;
  unidad: Unidad;
  metaValor: number;
  metaDir: "mayor" | "menor"; // cumple si real >= meta (mayor) o real <= meta (menor)
  nota?: string;
  pendiente?: boolean;
}

export interface IndicadorCalc extends Indicador {
  cumple: boolean | null;
  cumplimiento: number | null; // 0–100+ para el medidor
}

const ANIO = 2026;

export async function calcularIndicadores(
  usuario: UsuarioConRol,
  alcance: Alcance,
  mesesSel?: number[],
): Promise<IndicadorCalc[]> {
  const [meses, cartera, cxp, comprasAgg] = await Promise.all([
    flujoMensual(ANIO),
    resumenCartera(usuario, alcance),
    resumenCxp(),
    prisma.movimientoFlujo.aggregate({
      where: { anio: ANIO, tipo: "egreso", categoria: { is: { nombre: { startsWith: "PROVEEDORES" } } } },
      _sum: { valor: true },
    }),
  ]);

  // Meses seleccionados para los indicadores mensuales. "Sumar el período":
  // Utilidad y ventas = suma de los meses elegidos. Default: último mes con datos.
  const sel = mesesSel && mesesSel.length > 0
    ? meses.filter((m) => mesesSel.includes(m.mes))
    : (meses.length ? [meses[meses.length - 1]!] : []);
  const nSel = sel.length || 1;
  const utilidadMes = sel.length ? sel.reduce((s, m) => s + (m.ingresos - m.egresos), 0) : null;
  const ventasMes = sel.reduce((s, m) => s + m.ingresos, 0); // proxy: ventas del período

  // Cartera positiva (por edades) y vencida > 90
  const cub = cartera.porCubeta;
  const carteraPositiva = cub.d1_30.monto + cub.d31_60.monto + cub.d61_90.monto + cub.d91_120.monto + cub.mas120.monto;
  const vencida90 = cub.d91_120.monto + cub.mas120.monto;
  const pctVencida90 = carteraPositiva > 0 ? (vencida90 / carteraPositiva) * 100 : 0;

  // DSO ≈ CxC / ventas del período × (30 × nMeses). Proxy de ventas = ingresos.
  const dso = ventasMes > 0 ? (cartera.total / ventasMes) * (30 * nSel) : null;

  // Rotación CxP ≈ compras anualizadas / CxP (compras YTD proveedores × 12/nMeses)
  const nMeses = meses.filter((m) => m.egresos > 0).length || 1;
  const comprasYtd = comprasAgg._sum.valor?.toNumber() ?? 0;
  const comprasAnual = comprasYtd * (12 / nMeses);
  const rotacionCxp = cxp.total > 0 ? comprasAnual / cxp.total : null;

  const base: Indicador[] = [
    {
      num: 26, nombre: "Utilidad mensual", formula: "Ventas − Cuentas por pagar − Gastos",
      metaTexto: nSel === 1 ? "> $1.000M COP" : `> $1.000M/mes × ${nSel} = $${nSel}.000M`,
      frecuencia: "Mensual", real: utilidadMes, unidad: "cop",
      metaValor: 1_000_000_000 * nSel, metaDir: "mayor",
      nota: "Aprox: Ingresos − Egresos del período (flujo de caja). Confirmar mapeo de Ventas/Gastos.",
    },
    {
      num: 31, nombre: "Días de cartera — DSO", formula: "(Cuentas por cobrar / Ventas del período) × 30",
      metaTexto: "≤ 60 días", frecuencia: "Mensual", real: dso, unidad: "dias",
      metaValor: 60, metaDir: "menor",
      nota: "Proxy: 'Ventas del período' = ingresos del mes. Con ventas reales será exacto.",
    },
    {
      num: 32, nombre: "Margen bruto por línea", formula: "(Ventas línea − Costo línea) / Ventas línea × 100",
      metaTexto: "≥ 35%", frecuencia: "Trimestral", real: null, unidad: "pct",
      metaValor: 35, metaDir: "mayor", pendiente: true,
      nota: "Requiere ventas y costos por línea de producto (no cargados).",
    },
    {
      num: 33, nombre: "Rotación de cuentas por pagar", formula: "Compras / Promedio de Cuentas por Pagar",
      metaTexto: "≥ 6 veces/año", frecuencia: "Mensual", real: rotacionCxp, unidad: "veces",
      metaValor: 6, metaDir: "mayor",
      nota: "Aprox: compras = egresos a proveedores (anualizados); CxP = saldo actual (sin promedio histórico). No depende del mes seleccionado.",
    },
    {
      num: 34, nombre: "% Cartera vencida (> 90 días)", formula: "(Cartera > 90 días / Total cartera) × 100",
      metaTexto: "< 15%", frecuencia: "Mensual", real: pctVencida90, unidad: "pct",
      metaValor: 15, metaDir: "menor",
      nota: "Sobre el saldo actual de cartera. No depende del mes seleccionado.",
    },
  ];

  return base.map((i): IndicadorCalc => {
    if (i.real == null) return { ...i, cumple: null, cumplimiento: null };
    const cumple = i.metaDir === "mayor" ? i.real >= i.metaValor : i.real <= i.metaValor;
    // Cumplimiento para el medidor (0–100+): para "mayor" real/meta; para "menor" meta/real.
    const cumplimiento = i.metaDir === "mayor"
      ? (i.metaValor > 0 ? (i.real / i.metaValor) * 100 : 0)
      : (i.real > 0 ? (i.metaValor / i.real) * 100 : 100);
    return { ...i, cumple, cumplimiento };
  });
}
