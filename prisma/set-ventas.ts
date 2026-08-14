// ==========================================================
// Importa el reporte SIESA "FACTURAS POR ITEM" (nivel renglón):
//   1) guarda los renglones crudos en VentaDoc (reemplazo total), y
//   2) recalcula los agregados de venta neta (VentaLinea/Cliente/Marca/
//      MarcaIps + VentaDia) con escribirAgregados (mismo camino que la carga
//      por formulario). Venta Neta = Σ(subtotal) − Σ(NOTA_CREDITO).
//
// Fuente: todos los .xlsx de RUTA_VENTAS_DIR. Archivos grandes → más heap.
//
// Uso:   npm run db:ventas
//        DRY_RUN=1 npm run db:ventas          (sólo calcula y compara, no escribe)
//        RUTA_VENTAS_DIR="D:/otra/carpeta" npm run db:ventas
// ==========================================================
import "./_env";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { leerRenglones, agregarVentas, type FilaVenta } from "../src/lib/negocio/importar-ventas";
import { nroClave, type ParamNC } from "../src/lib/negocio/nota-credito";
import { escribirAgregados } from "../src/lib/negocio/escribir-ventas";

const prisma = new PrismaClient();
const DIR = process.env.RUTA_VENTAS_DIR ?? "D:/Escritorio/Ventas Consultas - copia (2)";
const DRY = process.env.DRY_RUN === "1";
const BATCH = 5000;
const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

async function crearEnLotes<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) await fn(rows.slice(i, i + BATCH));
}

async function main() {
  const archivos = fs.readdirSync(DIR).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith("~$"));
  if (archivos.length === 0) throw new Error(`No se hallaron .xlsx en ${DIR}`);
  console.log(`⚙  Fuente: ${DIR} · ${archivos.length} archivo(s)${DRY ? " · DRY-RUN" : ""}`);

  const filas: FilaVenta[] = [];
  for (const archivo of archivos) {
    const { filas: fs2, sinFecha, hoja } = leerRenglones(fs.readFileSync(path.join(DIR, archivo)));
    filas.push(...fs2);
    console.log(`   📄 ${archivo} (hoja "${hoja}"): ${fmt(fs2.length)} renglones, ${sinFecha} sin fecha`);
  }

  if (DRY) {
    const [pRows, xRows] = await Promise.all([prisma.parametroNotaCredito.findMany(), prisma.exclusionNC.findMany({ where: { concepto: "TODOS" } })]);
    const params: ParamNC[] = pRows.map((p) => ({ ips: p.ips, concepto: p.concepto, pct: p.pct.toNumber(), ini: p.fechaInicio.getTime(), fin: p.fechaFin.getTime() }));
    const agg = agregarVentas(filas, params, new Set(xRows.map((x) => nroClave(x.nroDocumento))));
    for (const anio of agg.anios) console.log(`   • ${anio}: venta neta $ ${fmt(agg.netoPorAnio.get(anio) ?? 0)}`);
    console.log(`🔎 DRY-RUN: nada escrito. NC total $ ${fmt(agg.totalNC)}`);
    return;
  }

  // 1) Renglones crudos → VentaDoc (reemplazo total).
  await prisma.ventaDoc.deleteMany({});
  await crearEnLotes(filas, (c) => prisma.ventaDoc.createMany({
    data: c.map((f) => ({
      nro: f.nro, tipo: f.tipo, aprobada: f.aprobada, fecha: new Date(f.ms), anio: f.anio, mes: f.mes, dia: new Date(f.ms).getUTCDate(),
      ips: f.ips, suc: f.suc, bod: f.bod, notas: f.notas, conv: f.conv, proc: f.proc, linea: f.linea,
      subtotal: r2(f.subtotal), fbd: f.fbd ?? null, costo: r2(f.costo), cliente: f.cliente, nit: f.nit, marca: f.marca,
      referencia: f.referencia, cantidad: r2(f.cantidad),
    })),
  }));

  // 2) Recalcular agregados (mismo camino que el formulario).
  const res = await escribirAgregados(prisma, filas);
  for (const anio of res.anios.sort((a, b) => a - b)) console.log(`   ✅ ${anio}: venta neta $ ${fmt(res.netoPorAnio.get(anio) ?? 0)}`);
  console.log(`✅ Ventas cargadas: ${fmt(filas.length)} renglones · NC total $ ${fmt(res.totalNC)}`);
}

main()
  .catch((e) => { console.error("❌ Error importando ventas:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
