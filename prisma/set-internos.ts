// ==========================================================
// Parámetro: proveedores INTERNOS (partes relacionadas).
// A los internos NO se les muestran los anticipos (saldos a favor);
// solo a los externos. Editable: agrega/quita NITs y vuelve a correr.
//   npm run db:internos
// ==========================================================
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// NIT/cédula de los terceros internos.
const INTERNOS_NIT = [
  "900616935",  // DISTRIBUCIONES PROVEMEDICS SAS
  "1129568893", // REATIGA AGUILAR JUAN GABRIEL
  "3729208",    // REATIGA HERNANDEZ IVAN
  "900978120",  // SANITHELP S.A.S
  "901112959",  // SERVICIOS LOGISTICOS E INTEGRALES EN SALUD SAS
  "32669191",   // AGUILAR CADAVID ANA MARIA
  "901523868",  // MOVID IPS S.A.S
];

async function main() {
  // Reinicia la marca y aplica la lista (idempotente).
  await prisma.tercero.updateMany({ data: { esInterno: false } });
  const r = await prisma.tercero.updateMany({
    where: { nit: { in: INTERNOS_NIT } },
    data: { esInterno: true },
  });
  const internos = await prisma.tercero.findMany({
    where: { esInterno: true },
    select: { nombre: true, nit: true },
    orderBy: { nombre: "asc" },
  });
  console.log(`✅ ${r.count} terceros marcados como INTERNOS:`);
  internos.forEach((t) => console.log(`   - ${t.nombre} (${t.nit})`));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
