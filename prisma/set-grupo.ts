// ==========================================================
// Parámetro: IPS del GRUPO EMPRESARIAL (clientes) y su CIUDAD.
// Marca esGrupo=true y asigna la ciudad. Editable: ajusta y re-corre.
//   npm run db:grupo
// ==========================================================
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// nit -> ciudad
const IPS_GRUPO: { nit: string; ciudad: string }[] = [
  { nit: "890322787", ciudad: "Cali" },        // CENTRO MEDICO JAMUNDI S.A.
  { nit: "900002780", ciudad: "Barranquilla" },// FUNDACION CAMPBELL
  { nit: "900267064", ciudad: "Santa Marta" }, // INVERSIONES AZALUD S A S
  { nit: "900469882", ciudad: "Cali" },        // CENTRO MEDICO SERVISALUD INTEGRAL IPS
  { nit: "900513306", ciudad: "Sincelejo" },   // FUNDACION MARIA REINA
  { nit: "900600550", ciudad: "Cartagena" },   // INVERSIONES MEDICAS BARU SAS
  { nit: "900616935", ciudad: "Barranquilla" },// DISTRIBUCIONES PROVEMEDICS SAS
  { nit: "900631361", ciudad: "Cali" },        // INVERSIONES MEDICAS VALLE SALUD SAS
  { nit: "900847382", ciudad: "Cali" },        // CENTRO MEDICO Y DE REHABILITACION VALLE SALUD
  { nit: "900900754", ciudad: "Cali" },        // CLINICA VALLE SALUD SAN FERNANDO SAS
  { nit: "901081281", ciudad: "Cali" },        // URGETRAUMA SAN FERNANDO S.A.S.
  { nit: "901149757", ciudad: "Cali" },        // UNIDAD MEDICA DE TRAUMA DEL VALLE S.A.S.
  { nit: "900657731", ciudad: "Santa Marta" }, // CENTRO MEDICO Y DE REHABILITACION BAHIA SAS
];

async function main() {
  await prisma.tercero.updateMany({ data: { esGrupo: false } });
  for (const ips of IPS_GRUPO) {
    await prisma.tercero.updateMany({ where: { nit: ips.nit }, data: { esGrupo: true, ciudad: ips.ciudad } });
  }
  const marcadas = await prisma.tercero.findMany({ where: { esGrupo: true }, select: { nombre: true, ciudad: true }, orderBy: { ciudad: "asc" } });
  console.log(`✅ ${marcadas.length} IPS del grupo marcadas:`);
  marcadas.forEach((t) => console.log(`   ${(t.ciudad ?? "—").padEnd(14)} ${t.nombre}`));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
