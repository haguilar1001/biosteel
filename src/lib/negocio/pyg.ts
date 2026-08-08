// ==========================================================
// Estado de Resultados (PyG). Lee EstadoResultados (importado de los PDF,
// ver set-pyg.ts) y expone el período mes a mes, el acumulado y los
// márgenes derivados. Metas de referencia: venta ≥ $2.000M, utilidad
// neta ≥ $200M por mes.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";

export const META_VENTA = 2_000_000_000;
export const META_UTILIDAD_NETA = 200_000_000;

export interface CuentaDet { cuenta: string; valor: number; pct?: number }

export interface PygMes {
  mes: number;
  ventasNetas: number;
  costoVenta: number;
  utilidadBruta: number;
  gastosOperacionales: number;
  utilidadOperacional: number;
  ingresosNoOp: number;
  egresosNoOp: number;
  utilidadNeta: number;
  // Derivados (%)
  margenBruto: number;
  margenOperacional: number;
  margenNeto: number;
  pesoCosto: number;   // costo / ventas
  pesoGastos: number;  // gastos op / ventas
  detalle: { ventas: CuentaDet[]; gastos: CuentaDet[] };
}

export interface PygAcumulado {
  meses: number;
  ventasNetas: number;
  costoVenta: number;
  utilidadBruta: number;
  gastosOperacionales: number;
  utilidadOperacional: number;
  ingresosNoOp: number;
  egresosNoOp: number;
  utilidadNeta: number;
  margenBruto: number;
  margenOperacional: number;
  margenNeto: number;
}

const pct = (n: number, d: number) => (d !== 0 ? (n / d) * 100 : 0);

/** Meses (1–12) que tienen PyG cargado, ascendente. */
export async function mesesConPyg(anio: number): Promise<number[]> {
  const rows = await prisma.estadoResultados.findMany({ where: { anio }, select: { mes: true }, orderBy: { mes: "asc" } });
  return rows.map((r) => r.mes);
}

export async function listarPyg(anio: number): Promise<PygMes[]> {
  const rows = await prisma.estadoResultados.findMany({ where: { anio }, orderBy: { mes: "asc" } });
  return rows.map((r) => {
    const ventasNetas = r.ventasNetas.toNumber();
    const detalle = (r.detalle as unknown as PygMes["detalle"] | null) ?? { ventas: [], gastos: [] };
    return {
      mes: r.mes,
      ventasNetas,
      costoVenta: r.costoVenta.toNumber(),
      utilidadBruta: r.utilidadBruta.toNumber(),
      gastosOperacionales: r.gastosOperacionales.toNumber(),
      utilidadOperacional: r.utilidadOperacional.toNumber(),
      ingresosNoOp: r.ingresosNoOp.toNumber(),
      egresosNoOp: r.egresosNoOp.toNumber(),
      utilidadNeta: r.utilidadNeta.toNumber(),
      margenBruto: pct(r.utilidadBruta.toNumber(), ventasNetas),
      margenOperacional: pct(r.utilidadOperacional.toNumber(), ventasNetas),
      margenNeto: pct(r.utilidadNeta.toNumber(), ventasNetas),
      pesoCosto: pct(r.costoVenta.toNumber(), ventasNetas),
      pesoGastos: pct(r.gastosOperacionales.toNumber(), ventasNetas),
      detalle,
    };
  });
}

export function acumuladoPyg(meses: PygMes[]): PygAcumulado {
  const a = meses.reduce(
    (s, m) => ({
      ventasNetas: s.ventasNetas + m.ventasNetas,
      costoVenta: s.costoVenta + m.costoVenta,
      utilidadBruta: s.utilidadBruta + m.utilidadBruta,
      gastosOperacionales: s.gastosOperacionales + m.gastosOperacionales,
      utilidadOperacional: s.utilidadOperacional + m.utilidadOperacional,
      ingresosNoOp: s.ingresosNoOp + m.ingresosNoOp,
      egresosNoOp: s.egresosNoOp + m.egresosNoOp,
      utilidadNeta: s.utilidadNeta + m.utilidadNeta,
    }),
    { ventasNetas: 0, costoVenta: 0, utilidadBruta: 0, gastosOperacionales: 0, utilidadOperacional: 0, ingresosNoOp: 0, egresosNoOp: 0, utilidadNeta: 0 },
  );
  return {
    meses: meses.length,
    ...a,
    margenBruto: pct(a.utilidadBruta, a.ventasNetas),
    margenOperacional: pct(a.utilidadOperacional, a.ventasNetas),
    margenNeto: pct(a.utilidadNeta, a.ventasNetas),
  };
}
