// ==========================================================
// Siembra el estado inicial de proveedores/marcas (tabla "ESTADO DE PROVEEDORES")
// cruzando cada nombre con las MARCAS de VentaMarca por palabra clave.
// Es editable después en la app; esto es solo la carga inicial.
//   npm run db:proveedor-estado
// ==========================================================
import "./_env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [palabra clave a buscar en la marca, estado, motivo]
const TABLA: [string, string, string][] = [
  ["STRYKER", "ACTIVO", "EN OPERACIÓN"],
  ["JOHNSON", "INACTIVO", "EMBARGO"],
  ["SAMPEDRO", "ACTIVO", "EN OPERACIÓN"],
  ["TODO ORTOPEDICO", "ACTIVO", "EN OPERACIÓN"],
  ["ARTHREX", "ACTIVO", "EN OPERACIÓN"],
  ["OSTEONORTE", "CON RESTRICCIÓN", "EN OPERACIÓN"],
  ["OSTEOAMERICA", "INACTIVO", "EMBARGO"],
  ["PROMED", "INACTIVO", "EMBARGO"],
  ["RP DENTAL", "ACTIVO", "EN OPERACIÓN"],
  ["SERVILOGISTICA", "ACTIVO", "EN OPERACIÓN"],
  ["GLOBAL LINK", "CON RESTRICCIÓN", "EN OPERACIÓN"],
  ["COSTA CARIBE", "INACTIVO", "EMBARGO"],
  ["TRAUMA STORE", "ACTIVO", "EN OPERACIÓN"],
  ["OSTEOTECH", "INACTIVO", "EMBARGO"],
  ["OSTEOBIOMED", "INACTIVO", "EMBARGO"],
  ["J MEDICAL", "INACTIVO", "COBRO PREJURIDICO"],
  ["LORENZ", "INACTIVO", "SIN OPERACIÓN"],
  ["SIFUENTES", "INACTIVO", "SIN OPERACIÓN"],
  ["ELEMENT", "INACTIVO", "SIN OPERACIÓN"],
  ["EXEL", "INACTIVO", "EMBARGO"],
  ["JELT", "INACTIVO", "SIN OPERACIÓN"],
  ["TOCAMEDIC", "ACTIVO", "EN OPERACIÓN"],
  ["IMEQ", "ACTIVO", "EN OPERACIÓN"],
  ["SERMEQS", "ACTIVO", "COBRO PREJURIDICO"],
  ["CKC", "INACTIVO", "SIN OPERACIÓN"],
  ["MEDTRONIC", "INACTIVO", "SIN OPERACIÓN"],
  ["ABUMAC", "ACTIVO", "EN OPERACIÓN"],
  ["ALLOGRAFT", "ACTIVO", "EN OPERACIÓN"],
  ["AMAREY", "ACTIVO", "COBRO PREJURIDICO"],
  ["DISTRI IMPLANTES", "INACTIVO", "SIN OPERACIÓN"],
  ["ORTHOSYSTEM", "ACTIVO", "SIN OPERACIÓN"],
  ["GENEFIX", "ACTIVO", "EN OPERACIÓN"],
  ["CORPOMEDICA", "ACTIVO", "EN OPERACIÓN"],
  ["EUROCIENCIA", "INACTIVO", "SIN OPERACIÓN"],
  ["QNA", "ACTIVO", "EN OPERACIÓN"],
  ["MACLO", "ACTIVO", "EN OPERACIÓN"],
  ["OSTEOMEDICAL", "ACTIVO", "EMBARGO"],
  ["IMPLAMEQ", "ACTIVO", "EN OPERACIÓN"],
  ["CLOSTER", "INACTIVO", "SIN OPERACIÓN"],
  ["TRAUMAFIT", "INACTIVO", "SIN OPERACIÓN"],
  ["ALSAMED", "INACTIVO", "SIN OPERACIÓN"],
  ["MEDIREX", "INACTIVO", "SIN OPERACIÓN"],
  ["BARRAZA", "INACTIVO", "SIN OPERACIÓN"],
  ["ORTOPEDICA INTEGRAL", "INACTIVO", "SIN OPERACIÓN"],
];

async function main() {
  const marcasRows = await prisma.ventaMarca.groupBy({ by: ["marca"] });
  const marcas = marcasRows.map((m) => m.marca);
  let ok = 0; const sinMatch: string[] = [];

  for (const [key, estado, motivo] of TABLA) {
    const match = marcas.filter((m) => m.toUpperCase().includes(key));
    if (match.length === 0) { sinMatch.push(key); continue; }
    for (const marca of match) {
      await prisma.proveedorEstado.upsert({
        where: { marca },
        update: { estado, motivo },
        create: { marca, estado, motivo },
      });
      ok++;
    }
  }

  console.log(`✅ Estados sembrados: ${ok} marcas.`);
  if (sinMatch.length) console.log(`   ⚠ Sin marca en ventas (clasifícalos en la app si aplica): ${sinMatch.join(", ")}`);
}

main().catch((e) => { console.error("❌ Error:", e); process.exit(1); }).finally(() => prisma.$disconnect());
