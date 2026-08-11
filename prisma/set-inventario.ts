// ==========================================================
// Carga inicial del Inventario de Equipos desde el Excel
// (hoja "INGRESO DE DATOS", 91 registros ya normalizados en
//  prisma/data/inventario-inicial.json).
//
// - Crea las sedes faltantes (Cartagena, Sincelejo, Yopal).
//   BioSteel se unifica con Barranquilla (misma sede).
// - Sincroniza los permisos inventario.view / inventario.manage.
// - Agrupa los ítems en Equipos (padre) por Sede + Categoría + Marca
//   y crea sus Ítems (hijos).
//
// Idempotente: borra el inventario existente y lo vuelve a cargar.
// Ejecutar: npm run db:inventario
// ==========================================================
import { PrismaClient, type AlcancePermiso } from "@prisma/client";
import { PERMISOS, ROLES_BASE, MATRIZ_ROLES } from "../src/lib/rbac/permissions";
import items from "./data/inventario-inicial.json";

const prisma = new PrismaClient();

type ItemInicial = {
  ciudad: string;
  categoria: string;
  marca: string;
  descripcion: string;
  tipo: "equipo" | "accesorio";
  cantidad: number;
  lote: string | null;
  estado: "activo" | "en_reparacion" | "de_baja" | "pendiente";
  observaciones: string | null;
};

async function main() {
  console.log("📦 Cargando inventario de equipos...");

  const empresa = await prisma.empresa.findFirstOrThrow();

  // --- 1) Asegurar sedes (crear faltantes; BioSteel = Barranquilla) ---
  const sedesNecesarias = [
    { ciudad: "Cartagena", nombre: "Bodega Cartagena", tipo: "bodega" as const },
    { ciudad: "Sincelejo", nombre: "Bodega Sincelejo", tipo: "bodega" as const },
    { ciudad: "Yopal", nombre: "Bodega Yopal", tipo: "bodega" as const },
  ];
  for (const s of sedesNecesarias) {
    const existe = await prisma.sede.findFirst({ where: { ciudad: s.ciudad, empresaId: empresa.id } });
    if (!existe) {
      await prisma.sede.create({ data: { ...s, empresaId: empresa.id } });
      console.log(`   + Sede creada: ${s.nombre}`);
    }
  }

  // Mapa ciudad -> sedeId (usa la primera sede de cada ciudad)
  const sedes = await prisma.sede.findMany({ where: { empresaId: empresa.id } });
  const sedePorCiudad = new Map<string, number>();
  for (const s of sedes) {
    if (!sedePorCiudad.has(s.ciudad)) sedePorCiudad.set(s.ciudad, s.id);
  }

  // --- 2) Sincronizar permisos de Inventarios + matriz de roles ---
  for (const p of PERMISOS) {
    await prisma.permiso.upsert({
      where: { clave: p.clave },
      update: { modulo: p.modulo, descripcion: p.descripcion },
      create: p,
    });
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
  console.log("   ✓ Permisos de Inventarios sincronizados");

  // --- 3) Limpiar inventario previo (idempotencia) ---
  await prisma.novedadInventario.deleteMany({});
  await prisma.itemInventario.deleteMany({});
  await prisma.equipoInventario.deleteMany({});

  // --- 4) Agrupar por Sede + Categoría + Marca -> Equipo (padre) ---
  const data = items as ItemInicial[];
  const grupos = new Map<string, ItemInicial[]>();
  for (const it of data) {
    const key = `${it.ciudad}||${it.categoria}||${it.marca}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(it);
  }

  let nEquipos = 0;
  let nItems = 0;
  for (const [key, lista] of grupos) {
    const [ciudad = "", categoria = "", marca = ""] = key.split("||");
    const sedeId = sedePorCiudad.get(ciudad);
    if (!sedeId) {
      console.warn(`   ! Sin sede para ciudad "${ciudad}" — omitido`);
      continue;
    }
    await prisma.equipoInventario.create({
      data: {
        sedeId,
        categoria,
        marca,
        items: {
          create: lista.map((it) => ({
            descripcion: it.descripcion,
            tipo: it.tipo,
            cantidad: it.cantidad,
            lote: it.lote,
            estado: it.estado,
            observaciones: it.observaciones,
          })),
        },
      },
    });
    nEquipos++;
    nItems += lista.length;
  }

  console.log(`✅ Inventario cargado: ${nEquipos} equipos · ${nItems} ítems.`);
}

main()
  .catch((e) => {
    console.error("❌ Error cargando inventario:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
