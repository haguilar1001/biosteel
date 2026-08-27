// ==========================================================
// Carga de los indicadores de calidad de Compras (FOR-GC-011) por consola.
// La vía normal es /cargar; esto es el respaldo, con los mismos parsers.
//
// Uso:  npm run db:ind-compras
//       DIR_INDICADORES="D:/otra/ruta" npm run db:ind-compras
// ==========================================================
import "./_env";
import fs from "node:fs";
import path from "node:path";
import {
  parseIndicadorCompras, persistirIndicadorCompras,
  parseEvaluacionProveedores, persistirEvaluacionProveedores,
} from "../src/lib/negocio/importar-indicador-compras";
import { prisma } from "../src/lib/db";

const DIR = process.env.DIR_INDICADORES ?? "D:/Escritorio";
const AUTOR = "consola (db:ind-compras)";
const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);

function buscar(pred: (nombre: string) => boolean): string | undefined {
  if (!fs.existsSync(DIR)) return undefined;
  const encontrados = fs.readdirSync(DIR)
    .filter((n) => n.toLowerCase().endsWith(".xlsx") && !n.startsWith("~$") && pred(n.toUpperCase()))
    .sort();
  return encontrados[0] ? path.join(DIR, encontrados[0]) : undefined;
}

const bitacora: Record<string, unknown> = {};

async function main() {
  console.log(`📐 Indicadores de Compras · leyendo de ${DIR}`);

  const rutaInd = buscar((n) => n.includes("INDICADOR DE COMPRA"));
  if (!rutaInd) {
    console.log("   · sin archivo de INDICADOR DE COMPRA");
  } else {
    const p = parseIndicadorCompras(fs.readFileSync(rutaInd));
    const cargadas = await persistirIndicadorCompras(p);
    const completas = p.datos.reduce((a, d) => a + d.ordenesCompletas, 0);
    const totales = p.datos.reduce((a, d) => a + d.ordenesTotales, 0);
    console.log(`   ✓ ${path.basename(rutaInd)} [${p.hoja}] → ${cargadas} mes(es) de ${p.anio}`);
    console.log(`     ${fmt(completas)} de ${fmt(totales)} órdenes completas · ${((completas / totales) * 100).toFixed(2)} %`);
    if (p.omitidas) console.log(`     · ${p.omitidas} mes(es) todavía sin diligenciar (no se guardan como cero)`);
    bitacora["ind-compras"] = { titulo: "Indicadores · Órdenes recibidas completas", archivo: path.basename(rutaInd), hoja: p.hoja, filas: p.filas, cargadas, omitidas: p.omitidas };
  }

  const rutaProv = buscar((n) => n.includes("RELACION PROVEEDORES"));
  if (!rutaProv) {
    console.log("   · sin archivo de RELACION PROVEEDORES");
  } else {
    const p = parseEvaluacionProveedores(fs.readFileSync(rutaProv));
    const cargadas = await persistirEvaluacionProveedores(p);
    console.log(`   ✓ ${path.basename(rutaProv)} → ${fmt(cargadas)} calificaciones · meses [${p.meses.join(", ")}] · ${p.activos.length} proveedores activos`);
    if (p.pctCorregidos.length) {
      console.log(`     ! ${p.pctCorregidos.length} porcentaje(s) del Excel no eran total/5 y se recalcularon:`);
      for (const x of p.pctCorregidos) console.log(`       · ${x}`);
    }
    if (p.totalesRaros.length) {
      console.log(`     ! ${p.totalesRaros.length} TOTAL que no es la suma de sus seis criterios:`);
      for (const x of p.totalesRaros) console.log(`       · ${x}`);
    }
    if (p.fueraDeCatalogo.length) {
      console.log(`     ! evaluados pero fuera de PROVEEDORES ACTIVOS: ${p.fueraDeCatalogo.join(", ")}`);
    }
    bitacora["ind-proveedores"] = { titulo: "Indicadores · Evaluación de Proveedores", archivo: path.basename(rutaProv), hoja: "hojas-mes", filas: p.evaluaciones.length, cargadas, omitidas: 0 };
  }

  if (Object.keys(bitacora).length) {
    await prisma.cargaSiesa.create({ data: { ok: true, resumen: { datasets: bitacora, usuario: AUTOR } as object } });
  }
  console.log("✅ Listo.");
}

main()
  .catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
