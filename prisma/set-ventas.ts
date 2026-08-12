// ==========================================================
// Importa el reporte SIESA "FACTURAS POR ITEM" (nivel renglón), calcula la
// Nota Crédito con el motor (src/lib/negocio/nota-credito) usando los
// parámetros y exclusiones de la BD, y pre-agrega la VENTA NETA a VentaLinea
// (línea×mes) y VentaCliente (cliente×mes) — delete+recreate por año.
//
//   Venta Neta = Σ(Valor subtotal local) − Σ(NOTA_CREDITO)   (cuadra con Power BI)
//
// Fuente: todos los .xlsx de RUTA_VENTAS_DIR (default la carpeta de consultas).
// Los archivos son grandes (8–22 MB); tsx hereda NODE_OPTIONS con más heap.
//
// Uso:   npm run db:ventas
//        DRY_RUN=1 npm run db:ventas          (sólo calcula y compara, no escribe)
//        RUTA_VENTAS_DIR="D:/otra/carpeta" npm run db:ventas
// ==========================================================
import "./_env";
import { PrismaClient, Prisma } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { leerRenglones, agregarVentas, type FilaLineaAgg, type FilaClienteAgg, type FilaMarcaAgg } from "../src/lib/negocio/importar-ventas";
import type { ParamNC } from "../src/lib/negocio/nota-credito";

const prisma = new PrismaClient();

const DIR = process.env.RUTA_VENTAS_DIR ?? "D:/Escritorio/Ventas Consultas - copia (2)";
const DRY = process.env.DRY_RUN === "1";

const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(v));
const dec = (v: number) => new Prisma.Decimal(Math.round(v * 100) / 100);

async function crearEnLotes<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>, size = 5000) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function main() {
  // 1) Parámetros y exclusiones desde la BD.
  const [pRows, xRows] = await Promise.all([
    prisma.parametroNotaCredito.findMany(),
    prisma.exclusionNC.findMany({ where: { concepto: "TODOS" } }),
  ]);
  if (pRows.length === 0) {
    throw new Error("No hay parámetros NC en la BD. Corre primero: npm run db:params-nc");
  }
  const params: ParamNC[] = pRows.map((p) => ({
    ips: p.ips, concepto: p.concepto, pct: p.pct.toNumber(),
    ini: p.fechaInicio.getTime(), fin: p.fechaFin.getTime(),
  }));
  const excluidos = new Set(xRows.map((x) => x.nroDocumento));
  console.log(`⚙  ${params.length} parámetros NC · ${excluidos.size} exclusiones · fuente: ${DIR}${DRY ? " · DRY-RUN" : ""}`);

  // 2) Leer y agregar cada archivo.
  const archivos = fs.readdirSync(DIR).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith("~$"));
  if (archivos.length === 0) throw new Error(`No se hallaron .xlsx en ${DIR}`);

  const lineasPorAnio = new Map<number, FilaLineaAgg[]>();
  const clientesPorAnio = new Map<number, FilaClienteAgg[]>();
  const marcasPorAnio = new Map<number, FilaMarcaAgg[]>();
  const netoPorAnio = new Map<number, number>();
  let totalNC = 0;

  for (const archivo of archivos) {
    const { filas, sinFecha, hoja } = leerRenglones(fs.readFileSync(path.join(DIR, archivo)));
    const agg = agregarVentas(filas, params, excluidos);
    totalNC += agg.totalNC;
    for (const [anio, neto] of agg.netoPorAnio) netoPorAnio.set(anio, (netoPorAnio.get(anio) ?? 0) + neto);
    for (const e of agg.porLinea) { const a = lineasPorAnio.get(e.anio) ?? []; a.push(e); lineasPorAnio.set(e.anio, a); }
    for (const e of agg.porCliente) { const a = clientesPorAnio.get(e.anio) ?? []; a.push(e); clientesPorAnio.set(e.anio, a); }
    for (const e of agg.porMarca) { const a = marcasPorAnio.get(e.anio) ?? []; a.push(e); marcasPorAnio.set(e.anio, a); }
    console.log(`   📄 ${archivo} (hoja "${hoja}"): ${fmt(filas.length)} renglones, ${sinFecha} sin fecha, NC ${fmt(agg.totalNC)}`);
  }

  // 3) Escribir por año (o sólo reportar en DRY-RUN).
  const anios = [...netoPorAnio.keys()].sort((a, b) => a - b);
  for (const anio of anios) {
    const lineas = lineasPorAnio.get(anio) ?? [];
    const clientes = clientesPorAnio.get(anio) ?? [];
    const marcas = marcasPorAnio.get(anio) ?? [];
    if (!DRY) {
      await prisma.$transaction([
        prisma.ventaLinea.deleteMany({ where: { anio } }),
        prisma.ventaCliente.deleteMany({ where: { anio } }),
        prisma.ventaMarca.deleteMany({ where: { anio } }),
      ]);
      await crearEnLotes(lineas, (c) => prisma.ventaLinea.createMany({ data: c.map((e) => ({ anio: e.anio, mes: e.mes, linea: e.linea, valor: dec(e.valor), costo: dec(e.costo) })) }));
      await crearEnLotes(clientes, (c) => prisma.ventaCliente.createMany({ data: c.map((e) => ({ anio: e.anio, mes: e.mes, clienteNombre: e.clienteNombre, nit: e.nit, valor: dec(e.valor), costo: dec(e.costo) })) }));
      await crearEnLotes(marcas, (c) => prisma.ventaMarca.createMany({ data: c.map((e) => ({ anio: e.anio, mes: e.mes, marca: e.marca, valor: dec(e.valor), costo: dec(e.costo) })) }));
    }
    console.log(`   ${DRY ? "•" : "✅"} ${anio}: venta neta $ ${fmt(netoPorAnio.get(anio) ?? 0)} (${lineas.length} líneas, ${clientes.length} clientes, ${marcas.length} marcas)`);
  }

  console.log(`${DRY ? "🔎 DRY-RUN: nada escrito." : "✅ Ventas reliquidadas (netas, multi-año)."} · NC total $ ${fmt(totalNC)}`);
}

main()
  .catch((e) => { console.error("❌ Error importando ventas:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
