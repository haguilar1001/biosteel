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
  parseMovimientos, persistirMovimientos, type MovimientosParsed,
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
  // SIESA los entrega consolidados o partidos por mes, y los archivos se
  // solapan (el de marzo trae febrero repetido; el consolidado los trae todos).
  //
  // NO se pueden deduplicar fila a fila: el "Orden interno" NO es estable entre
  // exportaciones. Junio traía 15.372 filas en su archivo y 15.371 en el
  // consolidado sin una sola clave repetida, y el mes quedó al doble.
  //
  // Regla: cada periodo lo aporta UN SOLO archivo, el más específico (el de
  // mes le gana al consolidado; entre dos del mismo tipo, el último en orden).
  if (hacer("movimientos")) {
    const rutas = buscar((n) => n.includes("MOVIMIENTOS") || /\bMOV\b/.test(n));
    if (!rutas.length) {
      console.log("   · sin archivos de movimientos en el directorio");
    } else {
      const catalogo = new Map(
        (await prisma.invBodega.findMany({ select: { codigo: true, instalacion: true } }))
          .map((b) => [b.codigo, b.instalacion] as const),
      );
      if (!catalogo.size) {
        console.error("❌ No hay bodegas cargadas. Corra primero el paso de bodegas.");
        process.exit(1);
      }
      const total: MovimientosParsed = {
        hoja: "", filas: 0, periodos: [], datos: [],
        bodegasNuevas: new Map(), bodegasDesconocidas: new Map(), choques: new Map(),
      };
      // periodo -> filas del archivo que lo aporta, con su rango para desempatar
      const elegido = new Map<string, { archivo: string; rango: number; filas: Record<string, unknown>[] }>();

      for (const [orden, ruta] of rutas.entries()) {
        const nombre = path.basename(ruta);
        // Un archivo por mes es más específico que el consolidado.
        const rango = nombre.toUpperCase().includes("MOVIMIENTOS") ? orden : 1000 + orden;
        const m = parseMovimientos(fs.readFileSync(ruta), catalogo);
        total.filas += m.filas;
        for (const [k, v] of m.bodegasNuevas) total.bodegasNuevas.set(k, v);
        for (const [k, v] of m.bodegasDesconocidas) total.bodegasDesconocidas.set(k, v);

        const porPeriodo = new Map<string, Record<string, unknown>[]>();
        for (const d of m.datos) {
          const p = `${d.anio}-${String(d.mes).padStart(2, "0")}`;
          const lista = porPeriodo.get(p) ?? [];
          lista.push(d); porPeriodo.set(p, lista);
        }
        const gana: string[] = [], pierde: string[] = [];
        for (const [p, filas] of porPeriodo) {
          const actual = elegido.get(p);
          if (actual && actual.rango >= rango) { pierde.push(p); continue; }
          elegido.set(p, { archivo: nombre, rango, filas });
          gana.push(p);
        }
        console.log(`   · ${nombre} → ${fmt(m.filas)} filas · aporta [${gana.sort().join(", ") || "—"}]${pierde.length ? ` · descartado en [${pierde.sort().join(", ")}]` : ""}`);
      }

      for (const [, v] of elegido) total.datos.push(...v.filas);
      // Los choques de instalación se cuentan solo sobre lo que quedó.
      for (const d of total.datos) {
        const cod = String(d.bodegaCodigo);
        const arch = d.instalacion as number | null;
        const cat = catalogo.get(cod);
        if (arch == null || cat == null || arch === cat) continue;
        const c = total.choques.get(cod) ?? { catalogo: cat, archivo: arch, movs: 0 };
        c.movs++; total.choques.set(cod, c);
      }
      total.periodos = [...elegido.keys()].sort();
      const cargadas = await persistirMovimientos(total);
      console.log(`   ✓ ${fmt(cargadas)} movimientos en ${total.periodos.length} periodo(s) [${total.periodos[0]} … ${total.periodos.at(-1)}]`);
      if (total.bodegasNuevas.size) {
        console.log(`     + ${total.bodegasNuevas.size} bodega(s) dadas de alta desde el archivo:`);
        for (const [cod, v] of total.bodegasNuevas) console.log(`        ${cod} — ${v.descripcion} → instalación ${v.instalacion}`);
      }
      if (total.choques.size) {
        console.log("     ⚠️  el catálogo dice otra instalación (manda el archivo):");
        for (const [cod, v] of total.choques) console.log(`        ${cod}: catálogo ${v.catalogo} → archivo ${v.archivo} (${fmt(v.movs)} movs)`);
      }
      if (total.bodegasDesconocidas.size) {
        console.log(`     ⚠️  ${total.bodegasDesconocidas.size} bodega(s) sin instalación quedaron fuera:`);
        for (const [cod, desc] of total.bodegasDesconocidas) console.log(`        ${cod} — ${desc}`);
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
