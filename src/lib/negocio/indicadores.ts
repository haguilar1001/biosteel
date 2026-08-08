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
import { ventaTotal } from "./ventas";
import { mesesConPyg } from "./pyg";

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
  const mesesSelIds = sel.map((m) => m.mes);

  // Recaudos = ingresos del flujo (abonos a cartera) del período.
  const recaudosMes = sel.reduce((s, m) => s + m.ingresos, 0);

  // Ventas reales (reporte por línea) y utilidad neta (PyG) del período.
  const [ventasMes, pygSel, pygMeses] = await Promise.all([
    ventaTotal(ANIO, mesesSelIds),
    prisma.estadoResultados.aggregate({
      where: { anio: ANIO, ...(mesesSelIds.length ? { mes: { in: mesesSelIds } } : {}) },
      _sum: { utilidadNeta: true },
      _count: { _all: true },
    }),
    mesesConPyg(ANIO),
  ]);
  const hayVentas = ventasMes > 0;
  const utilidadNeta = pygSel._count._all > 0 ? (pygSel._sum.utilidadNeta?.toNumber() ?? 0) : null;

  // Nota del indicador de Utilidad Neta según disponibilidad de PyG.
  const MES_LBL = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const ultimoPyg = pygMeses.length ? pygMeses[pygMeses.length - 1]! : null;
  const notaUtilNeta = utilidadNeta != null
    ? "Fuente: PyG mensual (utilidad del ejercicio)."
    : ultimoPyg
      ? `Aún no hay PyG del período seleccionado (último cargado: ${MES_LBL[ultimoPyg]}). Elige un mes con cierre o carga el PyG.`
      : "Cargar PyG con: npm run db:pyg.";

  // Cartera positiva (por edades) y vencida > 90
  const cub = cartera.porCubeta;
  const carteraPositiva = cub.d1_30.monto + cub.d31_60.monto + cub.d61_90.monto + cub.d91_120.monto + cub.mas120.monto;
  const vencida90 = cub.d91_120.monto + cub.mas120.monto;
  const pctVencida90 = carteraPositiva > 0 ? (vencida90 / carteraPositiva) * 100 : 0;

  // DSO ≈ CxC / ventas del período × (30 × nMeses). Si aún no hay ventas
  // cargadas, usa recaudos (ingresos) como proxy.
  const baseVentasDso = hayVentas ? ventasMes : recaudosMes;
  const dso = baseVentasDso > 0 ? (cartera.total / baseVentasDso) * (30 * nSel) : null;

  // Rotación CxP ≈ compras anualizadas / CxP (compras YTD proveedores × 12/nMeses)
  const nMeses = meses.filter((m) => m.egresos > 0).length || 1;
  const comprasYtd = comprasAgg._sum.valor?.toNumber() ?? 0;
  const comprasAnual = comprasYtd * (12 / nMeses);
  const rotacionCxp = cxp.total > 0 ? comprasAnual / cxp.total : null;

  const base: Indicador[] = [
    {
      num: 1, nombre: "Venta", formula: "Venta neta del período (reporte por línea)",
      metaTexto: nSel === 1 ? "≥ $2.000M COP" : `≥ $2.000M/mes × ${nSel} = $${(2 * nSel).toLocaleString("es-CO")}M`,
      frecuencia: "Mensual", real: hayVentas ? ventasMes : null, unidad: "cop",
      metaValor: 2_000_000_000 * nSel, metaDir: "mayor", pendiente: !hayVentas,
      nota: hayVentas ? "Fuente: reporte 'Venta por línea' (subtotal local, neto de notas crédito)." : "Cargar ventas con: npm run db:ventas.",
    },
    {
      num: 2, nombre: "Recaudo", formula: "Ingresos (abonos a cartera) del período",
      metaTexto: nSel === 1 ? "≥ $2.000M COP" : `≥ $2.000M/mes × ${nSel} = $${(2 * nSel).toLocaleString("es-CO")}M`,
      frecuencia: "Mensual", real: recaudosMes, unidad: "cop",
      metaValor: 2_000_000_000 * nSel, metaDir: "mayor",
      nota: "Fuente: ingresos del Flujo de Caja del período.",
    },
    {
      num: 3, nombre: "Utilidad Neta", formula: "Utilidad del ejercicio (Estado de Resultados)",
      metaTexto: nSel === 1 ? "≥ $200M COP" : `≥ $200M/mes × ${nSel} = $${(200 * nSel).toLocaleString("es-CO")}M`,
      frecuencia: "Mensual", real: utilidadNeta, unidad: "cop",
      metaValor: 200_000_000 * nSel, metaDir: "mayor", pendiente: utilidadNeta == null,
      nota: notaUtilNeta,
    },
    {
      num: 31, nombre: "Días de cartera — DSO", formula: "(Cuentas por cobrar / Ventas del período) × 30",
      metaTexto: "≤ 60 días", frecuencia: "Mensual", real: dso, unidad: "dias",
      metaValor: 60, metaDir: "menor",
      nota: hayVentas ? "Ventas reales (reporte por línea) del período." : "Sin ventas cargadas: usa ingresos como proxy hasta correr db:ventas.",
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
