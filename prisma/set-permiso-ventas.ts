// Sincroniza SOLO el permiso "ventas.manage" y sus concesiones por rol,
// sin tocar usuarios (a diferencia del seed completo). Idempotente.
//   npm run db:permiso-ventas
import "./_env";
import { PrismaClient, type AlcancePermiso } from "@prisma/client";
import { PERMISOS, MATRIZ_ROLES } from "../src/lib/rbac/permissions";

const prisma = new PrismaClient();
const CLAVE = "ventas.manage";

async function main() {
  const def = PERMISOS.find((p) => p.clave === CLAVE);
  if (!def) throw new Error(`No existe ${CLAVE} en el catálogo.`);

  const permiso = await prisma.permiso.upsert({
    where: { clave: CLAVE },
    update: { modulo: def.modulo, descripcion: def.descripcion },
    create: def,
  });

  let n = 0;
  for (const [rolNombre, matriz] of Object.entries(MATRIZ_ROLES)) {
    const alcance = matriz[CLAVE];
    if (!alcance) continue;
    const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
    if (!rol) continue;
    await prisma.rolPermiso.upsert({
      where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
      update: { alcance: alcance as AlcancePermiso },
      create: { rolId: rol.id, permisoId: permiso.id, alcance: alcance as AlcancePermiso },
    });
    n++;
    console.log(`   ✓ ${rolNombre}: ${alcance}`);
  }
  console.log(`✅ Permiso ${CLAVE} sincronizado (${n} roles).`);
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
