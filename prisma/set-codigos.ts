// ==========================================================
// Asigna código de inventario correlativo por categoría (MOT-001…)
// a los equipos que aún no lo tienen. Idempotente.
// Ejecutar: npm run db:codigos
// ==========================================================
import { PrismaClient } from "@prisma/client";
import { prefijoCodigo, formatCodigo, siguienteNumero } from "../src/lib/inventario-codigo";

const prisma = new PrismaClient();

async function main() {
  console.log("🏷️  Asignando códigos de inventario…");

  const equipos = await prisma.equipoInventario.findMany({ orderBy: { id: "asc" } });

  // Contador por prefijo, arrancando desde el máximo ya usado (idempotencia).
  const contador = new Map<string, number>();
  for (const e of equipos) {
    if (e.codigo) {
      const prefijo = prefijoCodigo(e.categoria);
      contador.set(prefijo, siguienteNumero(prefijo, [e.codigo, ...(contador.has(prefijo) ? [formatCodigo(prefijo, contador.get(prefijo)!)] : [])]) - 1);
    }
  }

  let n = 0;
  for (const e of equipos) {
    if (e.codigo) continue;
    const prefijo = prefijoCodigo(e.categoria);
    const siguiente = (contador.get(prefijo) ?? 0) + 1;
    contador.set(prefijo, siguiente);
    const codigo = formatCodigo(prefijo, siguiente);
    await prisma.equipoInventario.update({ where: { id: e.id }, data: { codigo } });
    console.log(`   ${codigo}  ←  ${e.categoria} · ${e.marca} (id ${e.id})`);
    n++;
  }

  console.log(`✅ ${n} equipos codificados.`);
}

main()
  .catch((err) => { console.error("❌ Error:", err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
