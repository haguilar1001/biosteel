// ==========================================================
// Carga masiva del INVENTARIO DE MATERIAL DE OSTEOSÍNTESIS desde los Excel
// de SIESA. Mismos parsers que la carga web (/cargar), pero por consola:
// el archivo de movimientos pesa más de lo que admite el formulario.
//
// Orden obligatorio: bodegas → balances → movimientos. Los movimientos se
// descartan si su bodega no está en el catálogo (sin instalación no concilian).
//
// Uso:   npm run db:inventario-osteo
//        DIR_INV="D:/otra/ruta" npm run db:inventario-osteo
//        SOLO=movimientos npm run db:inventario-osteo   (bodegas|balances|movimientos)
// ==========================================================
import "./_env";
import fs from "node:fs";
import path from "node:path";
import {
  parseTablasAuxiliares, persistirBodegas,
  parseBalance, persistirBalance,
  parseMovimientos, persistirMovimientos,
} from "../src/lib/negocio/importar-inventario";
import { prisma } from "../src/lib/db";

const DIR = process.env.DIR_INV ?? "D:/Escritorio";
const SOLO = process.env.SOLO ?? "";
const hacer = (paso: string) => !SOLO || SOLO === paso;
const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);

/** Primer archivo del directorio que cumple el predicado (SIESA varía los nombres). */
function buscar(pred: (nombre: string) => boolean): string[] {
  return fs.readdirSync(DIR)
    .filter((n) => n.toLowerCase().endsWith(".xlsx") && !n.startsWith("~$") && pred(n.toUpperCase()))
    .sort()
    .map((n) => path.join(DIR, n));
}

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`❌ No existe el directorio: ${DIR}`);
    process.exit(1);
  }
  console.log(`📦 Inventario de osteosíntesis · leyendo de ${DIR}`);

  // --- 1) Catálogo de bodegas (Tablas Auxiliares) ---
  if (hacer("bodegas")) {
    const [ruta] = buscar((n) => n.includes("TABLAS AUXILIARES"));
    if (!ruta) {
      console.error("❌ No encontré el archivo de TABLAS AUXILIARES.");
      process.exit(1);
    }
    const bodegas = parseTablasAuxiliares(fs.readFileSync(ruta));
    await persistirBodegas(bodegas);
    const porInst = [101, 102, 106].map((i) => `${i}: ${bodegas.filter((b) => b.instalacion === i).length}`).join(" · ");
    const inferidas = bodegas.filter((b) => b.inferida);
    console.log(`   ✓ ${path.basename(ruta)} → ${bodegas.length} bodegas [${porInst}]`);
    if (inferidas.length) console.log(`     ${inferidas.length} con instalación inferida: ${inferidas.map((b) => b.codigo).join(", ")}`);
  }

  // --- 2) Balances mensuales ---
  if (hacer("balances")) {
    const rutas = buscar((n) => n.includes("BALANCE"));
    if (!rutas.length) console.log("   · sin archivos de BALANCE en el directorio");
    for (const ruta of rutas) {
      const nombre = path.basename(ruta);
      const b = parseBalance(fs.readFileSync(ruta), nombre);
      const cargadas = await persistirBalance(b);
      const saldo = b.datos.reduce((a, d) => a + Number(d.valorFinal), 0);
      console.log(`   ✓ ${nombre} → ${b.mes}/${b.anio}: ${fmt(cargadas)} ítems de ${fmt(b.filas)} · saldo final $${fmt(saldo)}`);
    }
  }

  // --- 3) Movimientos ---
  if (hacer("movimientos")) {
    const [ruta] = buscar((n) => n.includes("MOVIMIENTOS"));
    if (!ruta) {
      console.log("   · sin archivo de MOVIMIENTOS en el directorio");
    } else {
      const conocidas = new Set((await prisma.invBodega.findMany({ select: { codigo: true } })).map((b) => b.codigo));
      if (!conocidas.size) {
        console.error("❌ No hay bodegas cargadas. Corra primero el paso de bodegas.");
        process.exit(1);
      }
      const m = parseMovimientos(fs.readFileSync(ruta), conocidas);
      const cargadas = await persistirMovimientos(m);
      console.log(`   ✓ ${path.basename(ruta)} → ${fmt(cargadas)} movimientos de ${fmt(m.filas)}`);
      console.log(`     periodos: ${m.periodos.length} [${m.periodos[0]} … ${m.periodos.at(-1)}]`);
      if (m.bodegasDesconocidas.size) {
        console.log(`     ⚠️  ${m.bodegasDesconocidas.size} bodega(s) sin catalogar quedaron fuera:`);
        for (const [cod, desc] of m.bodegasDesconocidas) console.log(`        ${cod} — ${desc}`);
      }
    }
  }

  const [nb, nbal, nmov] = await Promise.all([
    prisma.invBodega.count(), prisma.invBalance.count(), prisma.invMovimiento.count(),
  ]);
  console.log(`\n📊 En base: ${fmt(nb)} bodegas · ${fmt(nbal)} filas de balance · ${fmt(nmov)} movimientos`);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
