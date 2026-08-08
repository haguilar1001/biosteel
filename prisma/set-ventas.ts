// ==========================================================
// Importa el reporte de ventas (nivel renglón) y lo pre-agrega a
// VentaLinea (por línea × mes) y VentaCliente (por cliente × mes), por año.
//
// Medidas OFICIALES (coinciden con el Power BI, ver memoria venta-neta-formula):
//   Venta Neta = Σ("Valor subtotal local") − Σ("NOTA_CREDITO")
//   Costo      = Σ("Costo promedio total")
//
// Fuente por defecto: D:/Escritorio/Libro1.xlsx (export del Power BI, 2024–2026).
// El archivo es grande (~64 MB); se lee con más heap si hace falta:
//   node --max-old-space-size=8192 (tsx ya hereda el flag vía NODE_OPTIONS).
//
// Uso:   npm run db:ventas
//        RUTA_VENTAS="D:/otra/ruta.xlsx" npm run db:ventas
// ==========================================================
import "./_env";
import { PrismaClient, Prisma } from "@prisma/client";
import xlsx from "xlsx";

const prisma = new PrismaClient();

const RUTA = process.env.RUTA_VENTAS ?? "D:/Escritorio/Libro1.xlsx";

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function periodoDe(fecha: unknown): { anio: number; mes: number } | null {
  if (typeof fecha !== "string") return null;
  const m = fecha.toLowerCase().match(/de\s+([a-záéíóú]+)\s+de\s+(\d{4})/);
  if (!m) return null;
  const mes = MESES[m[1]!];
  if (!mes) return null;
  return { anio: Number(m[2]), mes };
}

interface Celda { anio: number; mes: number; valor: number; costo: number }
interface CeldaLinea extends Celda { linea: string }
interface CeldaCliente extends Celda { clienteNombre: string; nit: string | null }

async function main() {
  console.log(`📗 Leyendo ventas desde: ${RUTA}`);
  const wb = xlsx.readFile(RUTA, { dense: true });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const aoa = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true });
  const H = aoa[0] as string[];
  const ix = (n: string) => H.indexOf(n);
  const cF = ix("Fecha"), cSub = ix("Valor subtotal local"), cNC = ix("NOTA_CREDITO"),
    cCosto = ix("Costo promedio total"), cLinea = ix("LÍNEA"),
    cCli = ix("Razón social cliente despacho"), cNit = ix("Cliente factura");
  if (cF < 0 || cSub < 0 || cNC < 0 || cCosto < 0) {
    throw new Error("No se hallaron las columnas esperadas (Fecha / Valor subtotal local / NOTA_CREDITO / Costo promedio total).");
  }
  console.log(`   ${(aoa.length - 1).toLocaleString("es-CO")} renglones`);

  const porLinea = new Map<string, CeldaLinea>();
  const porCliente = new Map<string, CeldaCliente>();
  const anios = new Set<number>();
  let sinPeriodo = 0;

  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    if (!r) continue;
    const per = periodoDe(r[cF]);
    if (!per) { sinPeriodo++; continue; }
    anios.add(per.anio);
    const venta = (Number(r[cSub]) || 0) - (Number(r[cNC]) || 0); // NETA
    const costo = Number(r[cCosto]) || 0;

    const linea = String(r[cLinea] ?? "").trim() || "(sin línea)";
    const kL = `${per.anio}|${per.mes}|${linea}`;
    const eL = porLinea.get(kL) ?? { anio: per.anio, mes: per.mes, linea, valor: 0, costo: 0 };
    eL.valor += venta; eL.costo += costo;
    porLinea.set(kL, eL);

    const clienteNombre = String(r[cCli] ?? "").trim() || "(sin cliente)";
    const nit = r[cNit] != null ? String(r[cNit]).trim() : null;
    const kC = `${per.anio}|${per.mes}|${clienteNombre}`;
    const eC = porCliente.get(kC) ?? { anio: per.anio, mes: per.mes, clienteNombre, nit, valor: 0, costo: 0 };
    eC.valor += venta; eC.costo += costo;
    porCliente.set(kC, eC);
  }

  console.log(`   Años: ${[...anios].sort().join(", ")} · ${porLinea.size} (línea×mes), ${porCliente.size} (cliente×mes), sin período: ${sinPeriodo}`);

  const dec = (v: number) => new Prisma.Decimal(Math.round(v * 100) / 100);
  const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);

  for (const anio of [...anios].sort()) {
    await prisma.$transaction([
      prisma.ventaLinea.deleteMany({ where: { anio } }),
      prisma.ventaCliente.deleteMany({ where: { anio } }),
    ]);
    const lineas = [...porLinea.values()].filter((e) => e.anio === anio);
    const clientes = [...porCliente.values()].filter((e) => e.anio === anio);
    await prisma.ventaLinea.createMany({ data: lineas.map((e) => ({ anio: e.anio, mes: e.mes, linea: e.linea, valor: dec(e.valor), costo: dec(e.costo) })) });
    await prisma.ventaCliente.createMany({ data: clientes.map((e) => ({ anio: e.anio, mes: e.mes, clienteNombre: e.clienteNombre, nit: e.nit, valor: dec(e.valor), costo: dec(e.costo) })) });
    const totV = lineas.reduce((s, e) => s + e.valor, 0);
    console.log(`   ✅ ${anio}: venta neta $ ${fmt(totV)} (${lineas.length} líneas, ${clientes.length} clientes)`);
  }

  console.log("✅ Ventas importadas (netas, multi-año).");
}

main()
  .catch((e) => { console.error("❌ Error importando ventas:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
