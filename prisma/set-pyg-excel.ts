// ==========================================================
// Importa los Estados de Resultados (PyG) desde el Excel CONSOLIDADO a
// EstadoResultados. Alternativa a set-pyg.ts (que lee los PDF de SIESA).
// El parseo/persistencia vive en src/lib/negocio/importar-pyg-excel.ts
// (compartido con la carga web).
//
// Uso:   npm run db:pyg-excel
//        DRY=1 npm run db:pyg-excel            (solo imprime, no escribe)
//        RUTA_PYG_XLSX="D:/ruta/archivo.xlsx" ANIO_PYG=2026 npm run db:pyg-excel
// ==========================================================
import "./_env";
import { PrismaClient, Prisma } from "@prisma/client";
import fs from "node:fs";
import { parsePygExcel, persistirPyg } from "../src/lib/negocio/importar-pyg-excel";

const prisma = new PrismaClient();

const ANIO = Number(process.env.ANIO_PYG ?? 2026);
const RUTA = process.env.RUTA_PYG_XLSX
  ?? `D:/Datos/7 - Informes Ivan/1 - Estado de Resultados/01-E.R. Consolidado ${ANIO} BioSteel De Colombia.xlsx`;
const DRY = process.env.DRY === "1";

async function main() {
  if (!fs.existsSync(RUTA)) {
    console.error(`❌ No se encontró el Excel: ${RUTA}`);
    process.exit(1);
  }
  console.log(`📗 Leyendo PyG ${ANIO} desde Excel: ${RUTA}${DRY ? "  (DRY-RUN)" : ""}`);
  const { meses, omitidas } = parsePygExcel(fs.readFileSync(RUTA));
  const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
  for (const p of meses) {
    console.log(`   ✅ ${String(p.mes).padStart(2, "0")}: ventas ${fmt(p.ventasNetas)} · util. neta ${fmt(p.utilidadNeta)} · ${p.detalle.gastos.length} grupos de gasto`);
  }
  if (omitidas) console.warn(`   ⚠ ${omitidas} hoja(s)-mes omitida(s) por faltar anclajes.`);

  if (DRY) {
    console.log(`📗 DRY-RUN: ${meses.length} meses parseados (no se escribió nada).`);
    return;
  }
  const n = await persistirPyg(prisma, Prisma, ANIO, meses);
  console.log(`✅ PyG importado desde Excel (${n} meses).`);
}

main()
  .catch((e) => { console.error("❌ Error importando PyG (Excel):", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
