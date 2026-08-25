// ==========================================================
// Carga del archivo de PEDIDOS de SIESA por consola.
//
// La vía normal es /cargar dentro de la app; este script queda para recargas
// masivas o pruebas locales, y usa el mismo parser, así que da el mismo
// resultado.
//
// Uso:   npm run db:pedidos
//        DIR_PEDIDOS="D:/otra/ruta" npm run db:pedidos
//        ARCHIVO_PEDIDOS="D:/Escritorio/PEDIDOS 2026.xlsx" npm run db:pedidos
// ==========================================================
import "./_env";
import fs from "node:fs";
import path from "node:path";
import { parsePedidos, persistirPedidos } from "../src/lib/negocio/importar-pedidos";
import { prisma } from "../src/lib/db";

const DIR = process.env.DIR_PEDIDOS ?? "D:/Escritorio";
const AUTOR = "consola (db:pedidos)";
const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
const cop = (v: number) => `$${fmt(v)}`;

/** Archivo indicado a mano, o el primer PEDIDOS*.xlsx del directorio. */
function ruta(): string | undefined {
  const fijo = process.env.ARCHIVO_PEDIDOS;
  if (fijo) return fs.existsSync(fijo) ? fijo : undefined;
  if (!fs.existsSync(DIR)) return undefined;
  const encontrados = fs.readdirSync(DIR)
    .filter((n) => n.toLowerCase().endsWith(".xlsx") && !n.startsWith("~$") && n.toUpperCase().includes("PEDIDOS"))
    // Se descarta el reporte de pedidos PENDIENTES, que es otro archivo y
    // otra tabla (PedidoPendiente): comparten palabra pero no contenido.
    .filter((n) => !n.toUpperCase().includes("PENDIENTE"))
    .sort();
  return encontrados[0] ? path.join(DIR, encontrados[0]) : undefined;
}

async function main() {
  const archivo = ruta();
  if (!archivo) {
    console.error(`❌ No se encontró ningún PEDIDOS*.xlsx en ${DIR}`);
    process.exit(1);
  }
  console.log(`📝 Pedidos · leyendo ${archivo}`);

  const p = parsePedidos(fs.readFileSync(archivo));
  if (!p.datos.length) throw new Error("El archivo no trae pedidos con fecha válida.");
  const cargadas = await persistirPedidos(p);

  const docs = new Set(p.datos.map((d) => d.nroDocumento)).size;
  const refs = new Set(p.datos.map((d) => d.referencia)).size;
  const valor = p.datos.reduce((a, d) => a + Number(d.valorBruto), 0);
  const cant = p.datos.reduce((a, d) => a + Number(d.cantPedida), 0);
  console.log(`   ✓ [${p.hoja}] → ${fmt(cargadas)} renglones de ${fmt(p.filas)} · ${fmt(docs)} pedidos · ${fmt(refs)} referencias`);
  console.log(`     ${cop(valor)} · ${fmt(cant)} unidades pedidas`);
  console.log(`     periodos reemplazados: ${p.periodos.join(", ")}`);
  if (p.omitidas) console.log(`     ! ${fmt(p.omitidas)} renglones sin fecha (omitidos)`);

  await prisma.cargaSiesa.create({
    data: {
      ok: true,
      resumen: {
        datasets: {
          pedidos: {
            titulo: "Pedidos", archivo: path.basename(archivo), hoja: p.hoja,
            filas: p.filas, cargadas, omitidas: p.omitidas,
          },
        },
        usuario: AUTOR,
      } as object,
    },
  });

  console.log("✅ Listo.");
}

main()
  .catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
