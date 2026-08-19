// ==========================================================
// Recalcula TODOS los agregados de venta a partir de lo que ya está en
// VentaDoc, sin volver a leer los Excel de SIESA.
//
// Sirve cuando cambia la lógica o aparece un agregado nuevo (p. ej.
// VentaItemIps) y no vale la pena repetir la carga completa: los renglones
// no cambian, solo la forma de sumarlos. Usa exactamente el mismo motor que
// la carga (escribirAgregados), así que el resultado es idéntico.
//
// Uso:   npm run db:ventas-recalcular
// ==========================================================
import "./_env";
import { PrismaClient } from "@prisma/client";
import { escribirAgregados, docABitVenta } from "../src/lib/negocio/escribir-ventas";

const prisma = new PrismaClient();
const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);

async function main() {
  const total = await prisma.ventaDoc.count();
  if (!total) {
    console.error("❌ VentaDoc está vacío: no hay de dónde recalcular. Corra primero npm run db:ventas.");
    process.exit(1);
  }
  console.log(`🧮 Recalculando agregados de venta sobre ${fmt(total)} renglones de VentaDoc…`);

  const docs = await prisma.ventaDoc.findMany();
  const res = await escribirAgregados(prisma, docs.map(docABitVenta));

  console.log(`   ✓ años recalculados: ${res.anios.join(", ")}`);
  for (const [anio, neto] of [...res.netoPorAnio].sort((a, b) => a[0] - b[0])) {
    console.log(`     ${anio}: venta neta $${fmt(neto)}`);
  }
  console.log(`   ✓ notas crédito aplicadas: $${fmt(res.totalNC)}`);

  const [i, ii] = await Promise.all([prisma.ventaItem.count(), prisma.ventaItemIps.count()]);
  console.log(`\n📊 VentaItem: ${fmt(i)} filas · VentaItemIps: ${fmt(ii)} filas`);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
