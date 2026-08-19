// ==========================================================
// Carga las evaluaciones de asesores quirúrgicos (Asistencia Técnica) desde
// prisma/data/asistencia-tecnica.json, que salió del informe base de
// Coordinación Logística (240 evaluaciones, enero–junio 2026).
//
// Reemplaza los periodos que trae el archivo, así que se puede volver a
// correr. Cuando quede definido el Excel mensual, el importador va a leer de
// ahí y este script queda solo para la carga inicial.
//
// PQRS va aparte (tabla PqrsMes): no sale de las evaluaciones. Se siembra en
// cero para los meses cargados si no existe el registro.
//
// Uso:   npm run db:asistencia
// ==========================================================
import "./_env";
import { PrismaClient, Prisma } from "@prisma/client";
import evaluaciones from "./data/asistencia-tecnica.json";

const prisma = new PrismaClient();

interface Fila {
  fecha: string; paciente: string; procedimiento: string; ips: string;
  especialista: string; asesor: string;
  conocimiento: number; desempeno: number; capacidad: number; habilidad: number;
  novedades: boolean; eventos: boolean; incidentes: boolean;
}

async function main() {
  const filas = evaluaciones as Fila[];
  console.log(`🩺 Asistencia Técnica · ${filas.length} evaluaciones en el archivo`);

  const datos = filas.map((f) => {
    const [a, m, d] = f.fecha.split("-").map(Number);
    return {
      fecha: new Date(Date.UTC(a!, m! - 1, d!)),
      anio: a!, mes: m!,
      paciente: f.paciente, procedimiento: f.procedimiento, ips: f.ips,
      especialista: f.especialista, asesor: f.asesor,
      conocimiento: new Prisma.Decimal(f.conocimiento),
      desempeno: new Prisma.Decimal(f.desempeno),
      capacidad: new Prisma.Decimal(f.capacidad),
      habilidad: new Prisma.Decimal(f.habilidad),
      novedades: f.novedades, eventos: f.eventos, incidentes: f.incidentes,
    };
  });

  const periodos = [...new Set(datos.map((d) => `${d.anio}-${d.mes}`))].sort();
  for (const p of periodos) {
    const [anio, mes] = p.split("-").map(Number);
    await prisma.evaluacionAsesor.deleteMany({ where: { anio, mes } });
  }
  await prisma.evaluacionAsesor.createMany({ data: datos });
  console.log(`   ✓ ${datos.length} evaluaciones en ${periodos.length} periodo(s): ${periodos.join(", ")}`);

  // PQRS en cero para los meses cargados, si aún no hay registro.
  let creados = 0;
  for (const p of periodos) {
    const [anio, mes] = p.split("-").map(Number);
    const existe = await prisma.pqrsMes.findUnique({ where: { anio_mes: { anio: anio!, mes: mes! } } });
    if (existe) continue;
    await prisma.pqrsMes.create({ data: { anio: anio!, mes: mes!, casos: 0 } });
    creados++;
  }
  console.log(`   ✓ PQRS: ${creados} mes(es) sembrado(s) en cero (dato que se lleva aparte)`);

  const asesores = await prisma.evaluacionAsesor.groupBy({ by: ["asesor"], _count: true });
  console.log(`\n📊 ${asesores.length} asesores evaluados:`);
  for (const a of asesores.sort((x, y) => y._count - x._count)) {
    console.log(`   ${a.asesor} · ${a._count} evaluaciones`);
  }
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
