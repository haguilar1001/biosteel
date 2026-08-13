// ==========================================================
// Importa los Estados de Resultados (PyG) desde el Excel CONSOLIDADO a
// EstadoResultados. Alternativa a set-pyg.ts (que lee los PDF de SIESA).
//
// El libro trae una hoja por mes (ENERO … DICIEMBRE) con la misma estructura:
//   col B = etiqueta · col C = valor de cuenta detalle · col D = total de grupo
//   col E = % vertical (fracción 0–1). Los totales se anclan por ETIQUETA
//   (la fila cambia entre meses). Upsert por [anio, mes]: SIEMPRE agrega/
//   actualiza los meses que traiga el Excel, sin tocar los demás.
//
// Uso:   npm run db:pyg-excel
//        DRY=1 npm run db:pyg-excel            (solo imprime, no escribe)
//        RUTA_PYG_XLSX="D:/ruta/archivo.xlsx" ANIO_PYG=2026 npm run db:pyg-excel
// ==========================================================
import "./_env";
import { PrismaClient, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import fs from "node:fs";

const prisma = new PrismaClient();

const ANIO = Number(process.env.ANIO_PYG ?? 2026);
const RUTA = process.env.RUTA_PYG_XLSX
  ?? `D:/Datos/7 - Informes Ivan/1 - Estado de Resultados/01-E.R. Consolidado ${ANIO} BioSteel De Colombia.xlsx`;
const DRY = process.env.DRY === "1";

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** minúsculas, sin tildes, sin espacios extra. */
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/** Valor numérico de una celda (número directo o texto "1.234,56"). */
const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  // Formato local "1.234.567,89" → 1234567.89 ; también acepta "1234567.89".
  const limpio = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(limpio.replace(/[^\d.-]/g, "")) || 0;
};

interface CuentaDet { cuenta: string; valor: number; pct?: number }
interface Fila { r: number; label: string; nlabel: string; c: unknown; d: unknown; e: unknown }
interface PygMes {
  mes: number;
  ventasNetas: number; costoVenta: number; utilidadBruta: number;
  gastosOperacionales: number; utilidadOperacional: number;
  ingresosNoOp: number; egresosNoOp: number; utilidadNeta: number;
  detalle: { ventas: CuentaDet[]; gastos: CuentaDet[] };
}

// Cuentas de ventas conocidas (para el detalle, col C), con nombre limpio.
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

function parseHoja(ws: XLSX.WorkSheet, mes: number): PygMes | null {
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
    return null; // faltan anclajes → hoja incompleta, se omite
  }
  const gastosOperacionales = utilidadBruta - utilidadOperacional;

  // Detalle de ventas: cuentas conocidas (valor en col C).
  const ventas: CuentaDet[] = [];
  for (const [re, nombre] of VENTAS_LABELS) {
    const f = filas.find((x) => re.test(x.nlabel) && x.c != null);
    if (f) ventas.push({ cuenta: nombre, valor: num(f.c) });
  }

  // Grupos de gasto operacional: entre "GASTOS OPERACIONALES" y "UTILIDAD ...
  // OPERACIONAL", filas con total (col D) y % (col E). Se excluyen no operac.
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

async function main() {
  if (!fs.existsSync(RUTA)) {
    console.error(`❌ No se encontró el Excel: ${RUTA}`);
    process.exit(1);
  }
  console.log(`📗 Leyendo PyG ${ANIO} desde Excel: ${RUTA}${DRY ? "  (DRY-RUN)" : ""}`);
  const wb = XLSX.readFile(RUTA);
  const dec = (v: number) => new Prisma.Decimal(Math.round(v * 100) / 100);
  const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
  let n = 0;

  for (const nombreHoja of wb.SheetNames) {
    const mes = MESES[norm(nombreHoja)];
    if (!mes) continue; // hojas que no son un mes (CONSOLIDADO, Hoja2…)
    const p = parseHoja(wb.Sheets[nombreHoja]!, mes);
    if (!p) {
      console.warn(`   ⚠ ${nombreHoja}: faltan anclajes de totales. Se omite.`);
      continue;
    }
    console.log(`   ✅ ${String(mes).padStart(2, "0")} ${nombreHoja}: ventas ${fmt(p.ventasNetas)} · util. neta ${fmt(p.utilidadNeta)} · ${p.detalle.gastos.length} grupos de gasto`);

    if (DRY) { n++; continue; }
    const data = {
      ventasNetas: dec(p.ventasNetas), costoVenta: dec(p.costoVenta),
      utilidadBruta: dec(p.utilidadBruta), gastosOperacionales: dec(p.gastosOperacionales),
      utilidadOperacional: dec(p.utilidadOperacional), ingresosNoOp: dec(p.ingresosNoOp),
      egresosNoOp: dec(p.egresosNoOp), utilidadNeta: dec(p.utilidadNeta),
      detalle: p.detalle as unknown as Prisma.InputJsonValue,
    };
    await prisma.estadoResultados.upsert({
      where: { anio_mes: { anio: ANIO, mes } },
      update: data,
      create: { anio: ANIO, mes, ...data },
    });
    n++;
  }

  console.log(DRY ? `📗 DRY-RUN: ${n} meses parseados (no se escribió nada).` : `✅ PyG importado desde Excel (${n} meses).`);
}

main()
  .catch((e) => { console.error("❌ Error importando PyG (Excel):", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
