// ==========================================================
// Importa el PRESUPUESTO DE EGRESOS mes a mes desde el Excel a
// PresupuestoMensual. Parseo/persistencia compartidos con la carga web
// (src/lib/negocio/importar-presupuesto.ts).
//
// Uso:   npm run db:presupuesto
//        DRY=1 npm run db:presupuesto
//        RUTA_PPTO_XLSX="D:/ruta/archivo.xlsx" ANIO_PPTO=2026 npm run db:presupuesto
// ==========================================================
import "./_env";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import { parsePresupuesto, persistirPresupuesto } from "../src/lib/negocio/importar-presupuesto";

const prisma = new PrismaClient();

const ANIO = Number(process.env.ANIO_PPTO ?? 2026);
const RUTA = process.env.RUTA_PPTO_XLSX ?? "D:/Escritorio/PRESUPUESTO BIO STEEL PROYECTADO 2026.xlsx";
const DRY = process.env.DRY === "1";

async function main() {
  if (!fs.existsSync(RUTA)) { console.error(`❌ No se encontró el Excel: ${RUTA}`); process.exit(1); }
  console.log(`📘 Leyendo presupuesto ${ANIO} desde: ${RUTA}${DRY ? "  (DRY-RUN)" : ""}`);
  const parse = parsePresupuesto(fs.readFileSync(RUTA));
  const nf = new Intl.NumberFormat("es-CO");
  const totalPorMes = new Map<number, number>();
  for (const f of parse.filas) totalPorMes.set(f.mes, (totalPorMes.get(f.mes) ?? 0) + f.valor);
  console.log(`   Filas: ${parse.filas.length} · meses: ${parse.meses.join(", ")}`);
  for (const m of parse.meses) console.log(`   · mes ${String(m).padStart(2, "0")}: ${nf.format(Math.round(totalPorMes.get(m) ?? 0))}`);

  if (DRY) { console.log("📘 DRY-RUN: no se escribió nada."); return; }
  const r = await persistirPresupuesto(prisma, ANIO, parse);
  console.log(`✅ Presupuesto importado: ${r.cargadas} renglones (meses ${r.meses.join(", ")}).`);
}

main()
  .catch((e) => { console.error("❌ Error importando presupuesto:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
