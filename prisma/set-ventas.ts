// ==========================================================
// Importa "Venta por línea" (reporte SIESA, nivel renglón) y lo pre-agrega
// a VentaLinea (por línea × mes) y VentaCliente (por cliente × mes).
//
// El Excel vive en el equipo local; este script se corre localmente contra
// la BD (DATABASE_URL apunta a Railway), igual que set-obligaciones/impuestos.
//
// Uso:   npm run db:ventas
//        RUTA_VENTAS="D:/otra/ruta.xlsx" npm run db:ventas
// ==========================================================
import "./_env";
import { PrismaClient, Prisma } from "@prisma/client";
import xlsx from "xlsx";

const prisma = new PrismaClient();

const RUTA = process.env.RUTA_VENTAS ?? "D:/Escritorio/Venta por linea-2026.xlsx";

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Extrae {anio, mes} de una fecha en español larga ("viernes, 5 de junio de 2026"). */
function periodoDe(fecha: unknown): { anio: number; mes: number } | null {
  if (typeof fecha !== "string") return null;
  const m = fecha.toLowerCase().match(/de\s+([a-záéíóú]+)\s+de\s+(\d{4})/);
  if (!m) return null;
  const mes = MESES[m[1]!];
  if (!mes) return null;
  return { anio: Number(m[2]), mes };
}

async function main() {
  console.log(`📗 Leyendo ventas desde: ${RUTA}`);
  const wb = xlsx.readFile(RUTA);
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true });
  console.log(`   ${rows.length.toLocaleString("es-CO")} renglones`);

  // Agregación en memoria.
  const porLinea = new Map<string, { anio: number; mes: number; linea: string; valor: number }>();
  const porCliente = new Map<string, { anio: number; mes: number; clienteNombre: string; nit: string | null; valor: number }>();
  const anios = new Set<number>();
  let sinPeriodo = 0;

  for (const r of rows) {
    const per = periodoDe(r["Fecha"]);
    if (!per) { sinPeriodo++; continue; }
    anios.add(per.anio);
    const valor = Number(r["Valor subtotal local"]) || 0;

    const linea = String(r["LÍNEA"] ?? "").trim() || "(sin línea)";
    const kL = `${per.anio}|${per.mes}|${linea}`;
    const eL = porLinea.get(kL) ?? { anio: per.anio, mes: per.mes, linea, valor: 0 };
    eL.valor += valor;
    porLinea.set(kL, eL);

    const clienteNombre = String(r["Razón social cliente despacho"] ?? r["Cliente factura"] ?? "").trim() || "(sin cliente)";
    const nit = r["Cliente factura"] != null ? String(r["Cliente factura"]).trim() : null;
    const kC = `${per.anio}|${per.mes}|${clienteNombre}`;
    const eC = porCliente.get(kC) ?? { anio: per.anio, mes: per.mes, clienteNombre, nit, valor: 0 };
    eC.valor += valor;
    porCliente.set(kC, eC);
  }

  console.log(`   Agrupado: ${porLinea.size} (línea×mes), ${porCliente.size} (cliente×mes), sin período: ${sinPeriodo}`);

  const dec = (v: number) => new Prisma.Decimal(Math.round(v * 100) / 100);

  for (const anio of anios) {
    await prisma.$transaction([
      prisma.ventaLinea.deleteMany({ where: { anio } }),
      prisma.ventaCliente.deleteMany({ where: { anio } }),
    ]);
    await prisma.ventaLinea.createMany({
      data: [...porLinea.values()].filter((e) => e.anio === anio).map((e) => ({ ...e, valor: dec(e.valor) })),
    });
    await prisma.ventaCliente.createMany({
      data: [...porCliente.values()].filter((e) => e.anio === anio).map((e) => ({ ...e, valor: dec(e.valor) })),
    });
    console.log(`   ✅ Año ${anio} cargado.`);
  }

  console.log("✅ Ventas importadas.");
}

main()
  .catch((e) => { console.error("❌ Error importando ventas:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
