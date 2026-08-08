// ==========================================================
// Verificación rápida de la carga de Ventas y PyG.
// Uso:  npm run db:check
// ==========================================================
import "./_env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ANIO = Number(process.env.ANIO_CHECK ?? 2026);
const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
const MES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

async function main() {
  console.log(`\n🔎 Verificación de carga · año ${ANIO}\n`);

  // ---- Ventas por línea ----
  const nLinea = await prisma.ventaLinea.count();
  const nCliente = await prisma.ventaCliente.count();
  console.log(`VentaLinea: ${nLinea} filas · VentaCliente: ${nCliente} filas`);
  if (nLinea > 0) {
    const porMes = await prisma.ventaLinea.groupBy({ by: ["mes"], where: { anio: ANIO }, _sum: { valor: true } });
    const total = porMes.reduce((s, g) => s + (g._sum.valor?.toNumber() ?? 0), 0);
    console.log(`  Venta total ${ANIO}: $ ${fmt(total)}`);
    for (const g of porMes.sort((a, b) => a.mes - b.mes)) console.log(`   ${MES[g.mes]}: $ ${fmt(g._sum.valor?.toNumber() ?? 0)}`);
    const top = await prisma.ventaLinea.groupBy({ by: ["linea"], where: { anio: ANIO }, _sum: { valor: true } });
    console.log("  Top líneas:");
    for (const l of top.sort((a, b) => (b._sum.valor?.toNumber() ?? 0) - (a._sum.valor?.toNumber() ?? 0)).slice(0, 5))
      console.log(`   ${l.linea}: $ ${fmt(l._sum.valor?.toNumber() ?? 0)}`);
  } else {
    console.log("  ⚠ Sin ventas cargadas. Corre: npm run db:ventas");
  }

  // ---- PyG ----
  console.log("");
  const pyg = await prisma.estadoResultados.findMany({ where: { anio: ANIO }, orderBy: { mes: "asc" } });
  console.log(`EstadoResultados: ${pyg.length} meses`);
  if (pyg.length > 0) {
    for (const r of pyg) {
      const v = r.ventasNetas.toNumber(), un = r.utilidadNeta.toNumber();
      const margen = v ? ((un / v) * 100).toFixed(1) : "—";
      console.log(`   ${MES[r.mes]}: ventas $ ${fmt(v)} · util. neta $ ${fmt(un)} (${margen}%)`);
    }
  } else {
    console.log("  ⚠ Sin PyG cargado. Corre: npm run db:pyg");
  }

  console.log("\n✅ Verificación terminada.\n");
}

main()
  .catch((e) => { console.error("❌ Error en la verificación:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
