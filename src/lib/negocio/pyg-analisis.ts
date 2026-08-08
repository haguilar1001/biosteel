// ==========================================================
// "Skill financiera": motor determinístico que analiza el PyG y redacta
// conclusiones mes a mes y acumuladas. Sin dependencias externas: aplica
// reglas de análisis financiero (márgenes, estructura de costos y gastos,
// variación intermensual, cumplimiento de metas y proyección).
// ==========================================================
import "server-only";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { MESES_LABEL } from "./flujo";
import { META_VENTA, META_UTILIDAD_NETA, type PygMes, type PygAcumulado, type CuentaDet } from "./pyg";

export type Tono = "ok" | "warn" | "bad" | "info";
export interface Conclusion { tono: Tono; texto: string }
export interface AnalisisMes { mes: number; conclusiones: Conclusion[] }
export interface AnalisisPyg { mensual: AnalisisMes[]; acumulado: Conclusion[] }

const pctTxt = (v: number) => formatPorcentaje(v);
const pp = (v: number) => `${v >= 0 ? "+" : ""}${formatPorcentaje(v).replace(" %", " pp")}`; // puntos porcentuales
const delta = (act: number, ant: number) => (ant !== 0 ? ((act - ant) / Math.abs(ant)) * 100 : 0);

function mayorGasto(gastos: CuentaDet[]): CuentaDet | null {
  return gastos.length ? [...gastos].sort((a, b) => b.valor - a.valor)[0]! : null;
}

/** Conclusiones para un mes (comparado con el mes previo si existe). */
function analizarMes(m: PygMes, prev?: PygMes): Conclusion[] {
  const c: Conclusion[] = [];

  // 1) Venta vs meta.
  if (m.ventasNetas >= META_VENTA) {
    c.push({ tono: "ok", texto: `Venta de ${formatCOP(m.ventasNetas)}: cumple la meta de ${formatCOP(META_VENTA)} (${pctTxt((m.ventasNetas / META_VENTA - 1) * 100)} por encima).` });
  } else {
    c.push({ tono: "warn", texto: `Venta de ${formatCOP(m.ventasNetas)}: por debajo de la meta de ${formatCOP(META_VENTA)} (faltó ${formatCOP(META_VENTA - m.ventasNetas)}).` });
  }

  // 2) Utilidad neta vs meta + margen.
  if (m.utilidadNeta >= META_UTILIDAD_NETA) {
    c.push({ tono: "ok", texto: `Utilidad neta de ${formatCOP(m.utilidadNeta)} (margen ${pctTxt(m.margenNeto)}): supera la meta de ${formatCOP(META_UTILIDAD_NETA)}.` });
  } else if (m.utilidadNeta > 0) {
    c.push({ tono: "warn", texto: `Utilidad neta de ${formatCOP(m.utilidadNeta)} (margen ${pctTxt(m.margenNeto)}): positiva pero por debajo de la meta de ${formatCOP(META_UTILIDAD_NETA)}.` });
  } else {
    c.push({ tono: "bad", texto: `Utilidad neta de ${formatCOP(m.utilidadNeta)}: el mes cerró en pérdida.` });
  }

  // 3) Margen bruto y peso del costo.
  const tonoBruto: Tono = m.margenBruto >= 35 ? "ok" : m.margenBruto >= 28 ? "info" : "warn";
  c.push({ tono: tonoBruto, texto: `Margen bruto ${pctTxt(m.margenBruto)} — el costo de venta absorbe ${pctTxt(m.pesoCosto)} de la venta.` });

  // 4) Peso de los gastos operacionales.
  const gastosVsBruta = m.utilidadBruta !== 0 ? (m.gastosOperacionales / m.utilidadBruta) * 100 : 0;
  const tonoGastos: Tono = gastosVsBruta <= 55 ? "ok" : gastosVsBruta <= 75 ? "info" : "warn";
  c.push({ tono: tonoGastos, texto: `Gastos operativos de ${formatCOP(m.gastosOperacionales)} (${pctTxt(m.pesoGastos)} de la venta): consumen ${pctTxt(gastosVsBruta)} de la utilidad bruta.` });

  // 5) Mayor grupo de gasto.
  const mg = mayorGasto(m.detalle.gastos);
  if (mg) c.push({ tono: "info", texto: `El mayor gasto operativo fue ${mg.cuenta}: ${formatCOP(mg.valor)} (${pctTxt(m.ventasNetas ? (mg.valor / m.ventasNetas) * 100 : 0)} de la venta).` });

  // 6) Resultado no operacional.
  const noOp = m.ingresosNoOp - m.egresosNoOp;
  if (Math.abs(noOp) > 0.05 * Math.abs(m.utilidadOperacional || 1)) {
    if (noOp >= 0) c.push({ tono: "info", texto: `Lo no operacional aportó ${formatCOP(noOp)} (más ingresos que egresos no operacionales).` });
    else c.push({ tono: "warn", texto: `Lo no operacional restó ${formatCOP(-noOp)} a la utilidad (egresos no operacionales de ${formatCOP(m.egresosNoOp)}).` });
  }

  // 7) Peso de descuentos / notas crédito sobre la venta de material.
  const material = m.detalle.ventas.find((v) => /material/i.test(v.cuenta));
  const descuento = m.detalle.ventas.find((v) => /descuento|nota/i.test(v.cuenta));
  if (material && descuento && material.valor > 0) {
    const peso = (Math.abs(descuento.valor) / material.valor) * 100;
    const tono: Tono = peso >= 35 ? "warn" : "info";
    c.push({ tono, texto: `Los descuentos/notas crédito (${formatCOP(Math.abs(descuento.valor))}) equivalen al ${pctTxt(peso)} de la venta bruta de material.` });
  }

  // 8) Variación frente al mes anterior.
  if (prev) {
    const dVenta = delta(m.ventasNetas, prev.ventasNetas);
    const dNeta = delta(m.utilidadNeta, prev.utilidadNeta);
    const dMargen = m.margenNeto - prev.margenNeto;
    const tono: Tono = dNeta >= 0 ? "ok" : "warn";
    c.push({
      tono,
      texto: `Frente a ${MESES_LABEL[prev.mes]}: la venta ${dVenta >= 0 ? "subió" : "bajó"} ${pctTxt(Math.abs(dVenta))} y la utilidad neta ${dNeta >= 0 ? "subió" : "bajó"} ${pctTxt(Math.abs(dNeta))} (margen ${pp(dMargen)}).`,
    });
  }

  return c;
}

/** Conclusiones sobre el acumulado del período. */
function analizarAcumulado(meses: PygMes[], acc: PygAcumulado): Conclusion[] {
  const c: Conclusion[] = [];
  if (meses.length === 0) return c;

  const n = meses.length;
  const metaVentaAcc = META_VENTA * n;
  const metaUtilAcc = META_UTILIDAD_NETA * n;

  c.push({
    tono: acc.ventasNetas >= metaVentaAcc ? "ok" : "warn",
    texto: `Venta acumulada ${formatCOP(acc.ventasNetas)} en ${n} mes${n === 1 ? "" : "es"} vs. meta ${formatCOP(metaVentaAcc)} (${pctTxt((acc.ventasNetas / metaVentaAcc - 1) * 100)}).`,
  });

  c.push({
    tono: acc.utilidadNeta >= metaUtilAcc ? "ok" : acc.utilidadNeta > 0 ? "warn" : "bad",
    texto: `Utilidad neta acumulada ${formatCOP(acc.utilidadNeta)} (margen ${pctTxt(acc.margenNeto)}) vs. meta ${formatCOP(metaUtilAcc)}.`,
  });

  const cumplenUtil = meses.filter((m) => m.utilidadNeta >= META_UTILIDAD_NETA).length;
  c.push({ tono: cumplenUtil === n ? "ok" : cumplenUtil === 0 ? "bad" : "info", texto: `${cumplenUtil} de ${n} meses alcanzaron la meta de utilidad neta ($200M).` });

  // Mejor / peor mes por utilidad neta.
  const ordN = [...meses].sort((a, b) => b.utilidadNeta - a.utilidadNeta);
  const mejor = ordN[0]!, peor = ordN[ordN.length - 1]!;
  c.push({ tono: "info", texto: `Mejor mes: ${MESES_LABEL[mejor.mes]} (utilidad ${formatCOP(mejor.utilidadNeta)}, margen ${pctTxt(mejor.margenNeto)}). Más flojo: ${MESES_LABEL[peor.mes]} (${formatCOP(peor.utilidadNeta)}, ${pctTxt(peor.margenNeto)}).` });

  // Estructura promedio.
  c.push({ tono: "info", texto: `Estructura acumulada: costo ${pctTxt(acc.ventasNetas ? (acc.costoVenta / acc.ventasNetas) * 100 : 0)}, gastos operativos ${pctTxt(acc.ventasNetas ? (acc.gastosOperacionales / acc.ventasNetas) * 100 : 0)}, utilidad operacional ${pctTxt(acc.margenOperacional)}.` });

  // Tendencia del margen neto (primer vs último mes).
  if (n >= 2) {
    const dMargen = meses[n - 1]!.margenNeto - meses[0]!.margenNeto;
    c.push({
      tono: dMargen >= 0 ? "ok" : "warn",
      texto: `Tendencia del margen neto: ${pp(dMargen)} entre ${MESES_LABEL[meses[0]!.mes]} (${pctTxt(meses[0]!.margenNeto)}) y ${MESES_LABEL[meses[n - 1]!.mes]} (${pctTxt(meses[n - 1]!.margenNeto)}).`,
    });
  }

  // Top 3 gastos acumulados.
  const acumGasto = new Map<string, number>();
  for (const m of meses) for (const g of m.detalle.gastos) acumGasto.set(g.cuenta, (acumGasto.get(g.cuenta) ?? 0) + g.valor);
  const top3 = [...acumGasto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top3.length) {
    c.push({ tono: "info", texto: `Mayores gastos operativos del período: ${top3.map(([k, v]) => `${k} (${formatCOP(v)})`).join(", ")}.` });
  }

  // Proyección anual simple (run-rate del promedio mensual).
  const promNeta = acc.utilidadNeta / n;
  c.push({ tono: promNeta * 12 >= META_UTILIDAD_NETA * 12 ? "ok" : "info", texto: `A este ritmo (promedio ${formatCOP(promNeta)}/mes), la utilidad neta anual proyectada ≈ ${formatCOP(promNeta * 12)}.` });

  return c;
}

export function analizarPyg(meses: PygMes[], acc: PygAcumulado): AnalisisPyg {
  return {
    mensual: meses.map((m, i) => ({ mes: m.mes, conclusiones: analizarMes(m, i > 0 ? meses[i - 1] : undefined) })),
    acumulado: analizarAcumulado(meses, acc),
  };
}
