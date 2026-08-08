// ==========================================================
// Importa los Estados de Resultados (PyG) mensuales en PDF a EstadoResultados.
//
// Los PDF viven en el equipo local; este script se corre localmente contra
// la BD (DATABASE_URL apunta a Railway), igual que set-ventas/obligaciones.
//
// Estructura del PDF (SIESA): bloque VENTAS, bloque COSTO, y TRES totales
// "sueltos" (número + %) que son, en orden: Utilidad Bruta, Utilidad
// Operacional y Utilidad del Ejercicio. Los grupos de gasto vienen como
// "<Nombre> <valor> <%>". El orden del texto extraído puede barajarse, así
// que anclamos por etiqueta y por los tres totales sueltos.
//
// Uso:   npm run db:pyg
//        RUTA_PYG_BASE="D:/otra/carpeta/2026" ANIO_PYG=2026 npm run db:pyg
// ==========================================================
import "./_env";
import { PrismaClient, Prisma } from "@prisma/client";
import { PDFParse } from "pdf-parse";
import fs from "node:fs";

const prisma = new PrismaClient();

const ANIO = Number(process.env.ANIO_PYG ?? 2026);
const BASE = process.env.RUTA_PYG_BASE ?? `D:/Datos/7 - Informes Ivan/1 - Estado de Resultados/${ANIO}`;
const rutaMes = (mes: number) => {
  const mm = String(mes).padStart(2, "0");
  return `${BASE}/${mm}/98 - BioSteel de Colombia ${ANIO}${mm}.pdf`;
};

/** "3.603.464.890" → 3603464890 ; "1.169.885,00" → 1169885 ; "-1.399.824.015" → negativo. */
function parseNum(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
}

const RE_BARE = /^(-?\d[\d.]*)\s+-?\d+(?:,\d+)?\s*%$/;
const RE_PCT = /^(.+?)\s+(-?\d[\d.]*)\s+(-?\d+(?:,\d+)?)\s*%$/;

interface CuentaDet { cuenta: string; valor: number; pct?: number }

interface PygMes {
  mes: number;
  ventasNetas: number; costoVenta: number; utilidadBruta: number;
  gastosOperacionales: number; utilidadOperacional: number;
  ingresosNoOp: number; egresosNoOp: number; utilidadNeta: number;
  detalle: { ventas: CuentaDet[]; gastos: CuentaDet[] };
}

async function parseMes(mes: number): Promise<PygMes | null> {
  const ruta = rutaMes(mes);
  if (!fs.existsSync(ruta)) return null;

  const parser = new PDFParse({ data: fs.readFileSync(ruta) });
  const { text } = await parser.getText();
  const lineas = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const buscar = (re: RegExp): number | null => {
    for (const l of lineas) { const m = l.match(re); if (m) return parseNum(m[1]!); }
    return null;
  };

  const ventasNetas = buscar(/^Ingresos Operacionales\s+(-?[\d.]+)/) ?? 0;
  const costoVenta = buscar(/^Costo de venta\s+(-?[\d.]+)/) ?? 0;
  const ingresosNoOp = buscar(/^Ingresos No Operacionales\s+(-?[\d.]+)/i) ?? 0;
  const egresosNoOp = buscar(/^Egresos no operacionales\s+(-?[\d.]+)/i) ?? 0;

  // Los tres totales sueltos (número + %) en orden: bruta, operacional, ejercicio.
  const bare: number[] = [];
  for (const l of lineas) { const m = l.match(RE_BARE); if (m) bare.push(parseNum(m[1]!)); }
  if (bare.length < 3) {
    console.warn(`   ⚠ Mes ${mes}: se esperaban 3 totales de utilidad, se hallaron ${bare.length}. Se omite.`);
    return null;
  }
  const [utilidadBruta, utilidadOperacional, utilidadNeta] = [bare[0]!, bare[1]!, bare[2]!];
  const gastosOperacionales = utilidadBruta - utilidadOperacional;

  // Detalle de ventas (primera ocurrencia de cada cuenta conocida).
  const ventas: CuentaDet[] = [];
  const ventasLabels: [RegExp, string][] = [
    [/^Material de osteosintesis\s+(-?[\d.]+)$/i, "Material de osteosíntesis"],
    [/^Arrendamiento\s+(-?[\d.]+)$/i, "Arrendamiento"],
    [/^Venta de equipos\s+(-?[\d.]+)$/i, "Venta de equipos"],
    [/^Descuento notas cr\w*\s+(-?[\d.]+)$/i, "Descuento notas crédito"],
  ];
  for (const [re, nombre] of ventasLabels) {
    const l = lineas.find((x) => re.test(x));
    if (l) ventas.push({ cuenta: nombre, valor: parseNum(l.match(re)![1]!) });
  }

  // Grupos de gasto operacional (líneas con %), excluyendo ingresos/egresos no op.
  const gastos: CuentaDet[] = [];
  for (const l of lineas) {
    const m = l.match(RE_PCT);
    if (!m) continue;
    const cuenta = m[1]!.trim();
    if (/Ingresos No Operacional|Egresos no operacional/i.test(cuenta)) continue;
    gastos.push({ cuenta, valor: parseNum(m[2]!), pct: parseNum(m[3]!) });
  }

  return {
    mes, ventasNetas, costoVenta, utilidadBruta, gastosOperacionales,
    utilidadOperacional, ingresosNoOp, egresosNoOp, utilidadNeta,
    detalle: { ventas, gastos },
  };
}

async function main() {
  console.log(`📕 Leyendo PyG ${ANIO} desde: ${BASE}`);
  const dec = (v: number) => new Prisma.Decimal(Math.round(v * 100) / 100);
  let n = 0;

  for (let mes = 1; mes <= 12; mes++) {
    const p = await parseMes(mes);
    if (!p) continue;
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
    const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
    console.log(`   ✅ Mes ${String(mes).padStart(2, "0")}: ventas ${fmt(p.ventasNetas)} · util. neta ${fmt(p.utilidadNeta)}`);
  }

  console.log(`✅ PyG importado (${n} meses).`);
}

main()
  .catch((e) => { console.error("❌ Error importando PyG:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
