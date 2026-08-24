// ==========================================================
// Carga inicial de CIRUGÍAS (Consulta Cirugía Diaria) + sincroniza el permiso
// carga.cirugias. En adelante se carga desde Cargar archivos → Calidad.
// Ejecutar: npm run db:cirugias  [rutaExcel]
// ==========================================================
import { PrismaClient, type AlcancePermiso } from "@prisma/client";
import { readFileSync } from "node:fs";
import { PERMISOS, ROLES_BASE, MATRIZ_ROLES } from "../src/lib/rbac/permissions";
import { parseCirugias, persistirCirugias } from "../src/lib/negocio/importar-cirugias";

const prisma = new PrismaClient();
const RUTA = process.argv[2] ?? "C:/Users/HECTOR/Desktop/Consulta Cirugía Diaria.xlsx";

async function main() {
  console.log("🔪 Cargando cirugías…");

  for (const p of PERMISOS) {
    await prisma.permiso.upsert({ where: { clave: p.clave }, update: { modulo: p.modulo, descripcion: p.descripcion }, create: p });
  }
  for (const rolDef of ROLES_BASE) {
    const rol = await prisma.rol.findUnique({ where: { nombre: rolDef.nombre } });
    if (!rol) continue;
    for (const [clave, alcance] of Object.entries(MATRIZ_ROLES[rolDef.nombre])) {
      const permiso = await prisma.permiso.findUnique({ where: { clave } });
      if (!permiso) continue;
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
        update: { alcance: alcance as AlcancePermiso },
        create: { rolId: rol.id, permisoId: permiso.id, alcance: alcance as AlcancePermiso },
      });
    }
  }
  console.log("   ✓ Permiso carga.cirugias sincronizado");

  const parse = parseCirugias(readFileSync(RUTA));
  const cargadas = await persistirCirugias(prisma, parse.filas);
  console.log(`   ✓ ${cargadas} cirugías cargadas (omitidas ${parse.omitidas} por duplicado/fecha inválida)`);
  console.log("✅ Listo.");
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
