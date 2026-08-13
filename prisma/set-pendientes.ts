// ==========================================================
// Importa los 4 archivos de S1ESA del módulo PENDIENTES a la BD (carga inicial
// o de respaldo; el día a día lo hace el formulario /cargar). Cada dataset se
// REEMPLAZA por completo. Reutiliza el parser puro (src/lib/negocio/importar-siesa).
//
// Uso:   npm run db:pendientes
//        RUTA_PENDIENTES_DIR="D:/otra/carpeta" npm run db:pendientes
// Empareja los archivos por nombre: *facturaci*, *gasto*, *anulad*, *pendiente*.
// ==========================================================
import "./_env";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { parseDataset, type DatasetKey } from "../src/lib/negocio/importar-siesa-pendientes";

const prisma = new PrismaClient();
const DIR = process.env.RUTA_PENDIENTES_DIR ?? "D:/Escritorio";
const BATCH = 5000;
const fmt = (n: number) => new Intl.NumberFormat("es-CO").format(n);

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Empareja cada dataset con el primer archivo .xlsx cuyo nombre contenga la clave.
const PATRON: { clave: DatasetKey; re: RegExp }[] = [
  { clave: "facturacion", re: /facturaci/ },
  { clave: "gastos", re: /gasto/ },
  { clave: "anuladas", re: /anulad/ },
  { clave: "pendientes", re: /pendiente/ },
];

async function reemplazar(clave: DatasetKey, rows: Record<string, unknown>[]) {
  const crear = async (model: { deleteMany: (a: object) => Promise<unknown>; createMany: (a: { data: unknown }) => Promise<unknown> }) => {
    await model.deleteMany({});
    for (let i = 0; i < rows.length; i += BATCH) await model.createMany({ data: rows.slice(i, i + BATCH) });
  };
  if (clave === "facturacion") return crear(prisma.facturacionDoc as never);
  if (clave === "gastos") return crear(prisma.gastoDoc as never);
  if (clave === "anuladas") return crear(prisma.facturaAnulada as never);
  return crear(prisma.pedidoPendiente as never);
}

async function main() {
  if (!fs.existsSync(DIR)) throw new Error(`No existe la carpeta ${DIR}`);
  const archivos = fs.readdirSync(DIR).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith("~$"));
  console.log(`⚙  Carpeta: ${DIR} · ${archivos.length} .xlsx`);

  for (const { clave, re } of PATRON) {
    const nombre = archivos.find((f) => re.test(norm(f)));
    if (!nombre) { console.log(`   ⚠️  ${clave}: no se encontró archivo`); continue; }
    const buffer = fs.readFileSync(path.join(DIR, nombre));
    const parsed = parseDataset(clave, buffer);
    await reemplazar(clave, parsed.rows);
    console.log(`   ✅ ${clave}: ${fmt(parsed.rows.length)} filas (${parsed.omitidas} omitidas) ← ${nombre} [hoja "${parsed.hoja}"]`);
  }
  console.log("✅ Pendientes cargados.");
}

main()
  .catch((e) => { console.error("❌ Error importando pendientes:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
