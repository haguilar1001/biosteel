// ==========================================================
// Sincroniza el catálogo de permisos y la matriz de roles del CÓDIGO
// (src/lib/rbac/permissions.ts) contra la base.
//
// Hay que correrlo cada vez que se agrega un permiso nuevo: si el permiso
// existe en el código pero no en la BD, el módulo simplemente no aparece en
// el menú (deny-by-default) sin ningún mensaje de error.
//
// No toca usuarios ni empresa; a diferencia del seed completo, solo escribe
// Permiso y RolPermiso. Los roles creados a mano no se tocan: para esos hay
// que asignar el permiso desde Administración → Roles.
//
// Uso:   npm run db:permisos
//        DRY=1 npm run db:permisos     (solo reporta, no escribe)
// ==========================================================
import "./_env";
import { PrismaClient, type AlcancePermiso } from "@prisma/client";
import { PERMISOS, ROLES_BASE, MATRIZ_ROLES } from "../src/lib/rbac/permissions";

const prisma = new PrismaClient();
const DRY = process.env.DRY === "1";

async function main() {
  console.log(`🔐 Sincronizando permisos${DRY ? "  (DRY-RUN)" : ""}`);

  const existentes = new Set((await prisma.permiso.findMany({ select: { clave: true } })).map((p) => p.clave));
  const nuevos = PERMISOS.filter((p) => !existentes.has(p.clave));
  console.log(`   catálogo: ${PERMISOS.length} permisos · ${nuevos.length} nuevo(s)`);
  for (const p of nuevos) console.log(`     + ${p.clave} — ${p.descripcion}`);

  if (!DRY) {
    for (const p of PERMISOS) {
      await prisma.permiso.upsert({
        where: { clave: p.clave },
        update: { modulo: p.modulo, descripcion: p.descripcion },
        create: p,
      });
    }
  }

  // Matriz de los roles base. Solo se tocan los roles que ya existen.
  for (const rolDef of ROLES_BASE) {
    const rol = await prisma.rol.findUnique({ where: { nombre: rolDef.nombre } });
    if (!rol) { console.log(`   · rol "${rolDef.nombre}" no existe en la BD, se omite`); continue; }
    let cambios = 0;
    for (const [clave, alcance] of Object.entries(MATRIZ_ROLES[rolDef.nombre])) {
      const permiso = await prisma.permiso.findUnique({ where: { clave } });
      if (!permiso) continue;
      const actual = await prisma.rolPermiso.findUnique({
        where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
      });
      if (actual?.alcance === alcance) continue;
      cambios++;
      if (!DRY) {
        await prisma.rolPermiso.upsert({
          where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
          update: { alcance: alcance as AlcancePermiso },
          create: { rolId: rol.id, permisoId: permiso.id, alcance: alcance as AlcancePermiso },
        });
      }
    }
    console.log(`   ✓ ${rolDef.nombre}: ${cambios} permiso(s) ajustado(s)`);
  }

  // Los roles que no están en ROLES_BASE se crearon a mano: hay que avisarlos,
  // porque un permiso nuevo NO les llega solo.
  const aMano = await prisma.rol.findMany({
    where: { nombre: { notIn: ROLES_BASE.map((r) => r.nombre) } },
    select: { id: true, nombre: true, _count: { select: { usuarios: true } } },
  });
  if (aMano.length) {
    console.log("\n   ⚠️  Roles creados a mano (no reciben permisos nuevos automáticamente):");
    for (const r of aMano) console.log(`      ${r.nombre} · ${r._count.usuarios} usuario(s) — asígnelos en Administración → Roles`);
  }
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
