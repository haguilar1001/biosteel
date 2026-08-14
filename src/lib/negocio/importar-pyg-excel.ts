// ==========================================================
// Parseo + persistencia de los Estados de Resultados (PyG) desde el Excel
// CONSOLIDADO (una hoja por mes). Módulo compartido por:
//   · el CLI  prisma/set-pyg-excel.ts
//   · la carga web  src/lib/negocio/cargas.ts
// El parseo (parsePygExcel) es PURO; persistirPyg recibe el cliente Prisma.
//
// Estructura de cada hoja: col B=etiqueta · C=valor detalle · D=total grupo
// · E=% (fracción 0–1). Los totales se anclan por ETIQUETA (la fila varía).
// ==========================================================
import * as XLSX from "xlsx";
import type { PrismaClient, Prisma } from "@prisma/client";

export const MESES_HOJA: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const limpio = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(limpio.replace(/[^\d.-]/g, "")) || 0;
};

export interface CuentaDet { cuenta: string; valor: number; pct?: number }
export interface PygMesParsed {
  mes: number;
  ventasNetas: number; costoVenta: number; utilidadBruta: number;
  gastosOperacionales: number; utilidadOperacional: number;
  ingresosNoOp: number; egresosNoOp: number; utilidadNeta: number;
  detalle: { ventas: CuentaDet[]; gastos: CuentaDet[] };
}

interface Fila { r: number; label: string; nlabel: string; c: unknown; d: unknown; e: unknown }

const VENTAS_LABELS: [RegExp, string][] = [
  [/^material de osteosintesis$/, "Material de osteosíntesis"],
  [/^arrendamiento$/, "Arrendamiento"],
  [/^venta de equipos$/, "Venta de equipos"],
  [/^descuento notas cred/, "Descuento notas crédito"],
];

function leerFilas(ws: XLSX.WorkSheet): Fila[] {
  const rng = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const filas: Fila[] = [];
  for (let r = rng.s.r; r <= rng.e.r; r++) {
    const cell = (col: string) => ws[`${col}${r + 1}`]?.v;
    const b = cell("B");
    filas.push({ r: r + 1, label: b != null ? String(b) : "", nlabel: norm(b), c: cell("C"), d: cell("D"), e: cell("E") });
  }
  return filas;
}

function parseHoja(ws: XLSX.WorkSheet, mes: number): PygMesParsed | null {
  const filas = leerFilas(ws);
  const totalDe = (etiqueta: string): number | null => {
    const f = filas.find((x) => x.nlabel === etiqueta);
    return f ? num(f.d) : null;
  };

  const ventasNetas = totalDe("ingresos operacionales");
  const costoVenta = totalDe("costo de venta");
  const utilidadBruta = totalDe("utilidad o perdida bruta");
  const utilidadOperacional = totalDe("utilidad o perdida operacional");
  const utilidadNeta = totalDe("utilidad del ejercicio");
  const ingresosNoOp = totalDe("ingresos no operacionales") ?? 0;
  const egresosNoOp = totalDe("egresos no operacionales") ?? 0;

  if (ventasNetas == null || costoVenta == null || utilidadBruta == null || utilidadOperacional == null || utilidadNeta == null) {
    return null;
  }
  const gastosOperacionales = utilidadBruta - utilidadOperacional;

  const ventas: CuentaDet[] = [];
  for (const [re, nombre] of VENTAS_LABELS) {
    const f = filas.find((x) => re.test(x.nlabel) && x.c != null);
    if (f) ventas.push({ cuenta: nombre, valor: num(f.c) });
  }

  const gastos: CuentaDet[] = [];
  const iIni = filas.findIndex((x) => x.nlabel === "gastos operacionales");
  const iFin = filas.findIndex((x) => x.nlabel === "utilidad o perdida operacional");
  if (iIni >= 0 && iFin > iIni) {
    for (let i = iIni + 1; i < iFin; i++) {
      const f = filas[i]!;
      const tieneTotal = f.d != null && f.d !== "" && !Number.isNaN(num(f.d));
      const tienePct = f.e != null && f.e !== "";
      if (f.nlabel && tieneTotal && tienePct) {
        gastos.push({ cuenta: f.label.trim(), valor: num(f.d), pct: Math.round(num(f.e) * 10000) / 100 });
      }
    }
  }

  return { mes, ventasNetas, costoVenta, utilidadBruta, gastosOperacionales, utilidadOperacional, ingresosNoOp, egresosNoOp, utilidadNeta, detalle: { ventas, gastos } };
}

export interface PygExcelParseado { hoja: string; meses: PygMesParsed[]; omitidas: number; }

/** Parsea el libro completo: una entrada por hoja-mes válida. */
export function parsePygExcel(buffer: Buffer): PygExcelParseado {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const meses: PygMesParsed[] = [];
  const hojasMes: string[] = [];
  let omitidas = 0;
  for (const nombre of wb.SheetNames) {
    const mes = MESES_HOJA[norm(nombre)];
    if (!mes) continue;
    hojasMes.push(nombre);
    const p = parseHoja(wb.Sheets[nombre]!, mes);
    if (p) meses.push(p); else omitidas++;
  }
  meses.sort((a, b) => a.mes - b.mes);
  return { hoja: hojasMes.join(", "), meses, omitidas };
}

/** Upsert por [anio, mes]: agrega/actualiza los meses parseados, sin tocar el resto. */
export async function persistirPyg(prisma: PrismaClient, PrismaNS: typeof Prisma, anio: number, meses: PygMesParsed[]): Promise<number> {
  const dec = (v: number) => new PrismaNS.Decimal(Math.round(v * 100) / 100);
  let n = 0;
  for (const p of meses) {
    const data = {
      ventasNetas: dec(p.ventasNetas), costoVenta: dec(p.costoVenta),
      utilidadBruta: dec(p.utilidadBruta), gastosOperacionales: dec(p.gastosOperacionales),
      utilidadOperacional: dec(p.utilidadOperacional), ingresosNoOp: dec(p.ingresosNoOp),
      egresosNoOp: dec(p.egresosNoOp), utilidadNeta: dec(p.utilidadNeta),
      detalle: p.detalle as unknown as Prisma.InputJsonValue,
    };
    await prisma.estadoResultados.upsert({
      where: { anio_mes: { anio, mes: p.mes } },
      update: data,
      create: { anio, mes: p.mes, ...data },
    });
    n++;
  }
  return n;
}
