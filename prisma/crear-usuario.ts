// ==========================================================
// Crear/actualizar un usuario administrador puntual.
// Los datos vienen de variables de entorno (NUNCA en el código · BIO-SEC-003).
// Uso (PowerShell):
//   $env:NUEVO_EMAIL="tu@correo"; $env:NUEVO_CLAVE="..."; $env:NUEVO_NOMBRE="Nombre"; npx tsx prisma/crear-usuario.ts
// Idempotente: si el email existe, actualiza clave/rol/nombre.
// ==========================================================
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const NOMBRE = process.env.NUEVO_NOMBRE;
const EMAIL = process.env.NUEVO_EMAIL;
const CLAVE = process.env.NUEVO_CLAVE;
const ROL = process.env.NUEVO_ROL ?? "Administrador";

async function main() {
  if (!NOMBRE || !EMAIL || !CLAVE) {
    throw new Error("Faltan NUEVO_NOMBRE, NUEVO_EMAIL y NUEVO_CLAVE en el entorno.");
  }
  const rol = await prisma.rol.findUniqueOrThrow({ where: { nombre: ROL } });
  const passwordHash = await hash(CLAVE, ARGON);

  const usuario = await prisma.usuario.upsert({
    where: { email: EMAIL },
    update: { nombre: NOMBRE, passwordHash, rolId: rol.id, activo: true },
    create: { nombre: NOMBRE, email: EMAIL, passwordHash, rolId: rol.id, sedeId: null, activo: true },
  });
  console.log(`✅ Usuario listo: ${usuario.nombre} <${usuario.email}> · rol ${ROL}. Cambia la clave tras el primer ingreso.`);
}

main().catch((e) => { console.error("❌ Error:", e); process.exit(1); }).finally(() => prisma.$disconnect());
