// ==========================================================
// Normaliza el campo `lista` de VentaItemIps: convierte los CÓDIGOS (4, 14…) a
// su NOMBRE (SOAT, COOSALUD MAIS…). La base tenía mezclados código+nombre (una
// carga vieja con código y una nueva con nombre), lo que duplicaba las listas
// en el filtro de Consumos y partía los datos.
//
// Como VentaItemIps tiene @@unique([anio,mes,marca,referencia,ips,lista]), al
// renombrar un código puede chocar con una fila que ya tenía el nombre: en ese
// caso se FUSIONAN (se suman valor/costo/cantidad) antes de renombrar.
// Idempotente. Ejecutar: npm run db:normalizar-listas
// ==========================================================
import { PrismaClient } from "@prisma/client";
import { nombreLista, esCodigoLista } from "../src/lib/negocio/listas-precio";

const prisma = new PrismaClient();

async function main() {
  console.log("🏷️  Normalizando listas de precios (código → nombre)…");

  // --- 1) Fusionar las filas que ya venían con NOMBRE contra su gemela por CÓDIGO ---
  const filas = await prisma.ventaItemIps.findMany({
    select: { id: true, anio: true, mes: true, marca: true, referencia: true, ips: true, lista: true, valor: true, costo: true, cantidad: true },
  });
  const conNombre = filas.filter((f) => f.lista && !esCodigoLista(f.lista));
  let fusionadas = 0;
  for (const R of conNombre) {
    const hermanas = await prisma.ventaItemIps.findMany({
      where: { anio: R.anio, mes: R.mes, marca: R.marca, referencia: R.referencia, ips: R.ips },
      select: { id: true, lista: true, valor: true, costo: true, cantidad: true },
    });
    const gemela = hermanas.find((c) => c.id !== R.id && esCodigoLista(c.lista) && nombreLista(c.lista) === R.lista);
    if (!gemela) continue; // no choca: se renombrará sola en el paso 2
    await prisma.ventaItemIps.update({
      where: { id: gemela.id },
      data: { valor: gemela.valor.plus(R.valor), costo: gemela.costo.plus(R.costo), cantidad: gemela.cantidad.plus(R.cantidad) },
    });
    await prisma.ventaItemIps.delete({ where: { id: R.id } });
    fusionadas++;
  }
  console.log(`   ✓ ${fusionadas} filas nombre↔código fusionadas`);

  // --- 2) Renombrar en bloque los códigos restantes ---
  const grupos = await prisma.ventaItemIps.groupBy({ by: ["lista"] });
  let renombradas = 0;
  for (const g of grupos) {
    if (!g.lista || !esCodigoLista(g.lista)) continue;
    const nom = nombreLista(g.lista);
    if (nom === g.lista) continue;
    const res = await prisma.ventaItemIps.updateMany({ where: { lista: g.lista }, data: { lista: nom } });
    console.log(`   "${g.lista}" → "${nom}" (${res.count} filas)`);
    renombradas += res.count;
  }

  console.log(`✅ Listo. ${fusionadas} fusionadas · ${renombradas} renombradas.`);
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
