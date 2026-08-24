// ==========================================================
// Carga inicial de ENCUESTAS DE SATISFACCIÓN (institucional + ortopedistas)
// y sincronización del permiso carga.encuestas. En adelante las cargas se
// hacen desde la web (Cargar archivos → Calidad).
// Ejecutar: npm run db:encuestas  [rutaInstitucional] [rutaOrtopedistas]
// ==========================================================
import { PrismaClient, type AlcancePermiso } from "@prisma/client";
import { readFileSync } from "node:fs";
import { PERMISOS, ROLES_BASE, MATRIZ_ROLES } from "../src/lib/rbac/permissions";
import { parseInstitucional, parseOrtopedistas, persistirEncuestas } from "../src/lib/negocio/importar-encuestas";

const prisma = new PrismaClient();

const RUTA_INST = process.argv[2] ?? "C:/Users/HECTOR/Desktop/Consolidado_Completo_Encuestas_Satisfaccion_2026(1).xlsx";
const RUTA_ORTHO = process.argv[3] ?? "C:/Users/HECTOR/Desktop/Encuesta de Satisfacción del Cliente – Ortopedistas(1-8) (1).xlsx";

async function main() {
  console.log("😊 Cargando encuestas de satisfacción…");

  // --- Permiso carga.encuestas + matriz de roles ---
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
  console.log("   ✓ Permiso carga.encuestas sincronizado");

  // --- Institucional ---
  const inst = parseInstitucional(readFileSync(RUTA_INST));
  const nInst = await persistirEncuestas(prisma, "institucional", inst.filas);
  console.log(`   ✓ Institucional: ${nInst} encuestas (omitidas ${inst.omitidas})`);

  // --- Ortopedistas ---
  const ortho = parseOrtopedistas(readFileSync(RUTA_ORTHO));
  const nOrtho = await persistirEncuestas(prisma, "ortopedista", ortho.filas);
  console.log(`   ✓ Ortopedistas: ${nOrtho} encuestas (omitidas ${ortho.omitidas})`);

  console.log("✅ Encuestas cargadas.");
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
