// ==========================================================
// Crear usuario administrador puntual
// Uso: npx tsx prisma/crear-usuario.ts
// Idempotente: si el email existe, actualiza clave/rol/nombre.
// ==========================================================
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const NOMBRE = "Hector Aguilar";
const EMAIL = "hectoralonsoaguilar@gmail.com";
const CLAVE = "Biosteel2026";
const ROL = "Administrador"; // rol de máximo privilegio (Super Admin)

async function main() {
  const rol = await prisma.rol.findUniqueOrThrow({ where: { nombre: ROL } });
  const passwordHash = await hash(CLAVE, ARGON);

  const usuario = await prisma.usuario.upsert({
    where: { email: EMAIL },
    update: { nombre: NOMBRE, passwordHash, rolId: rol.id, activo: true },
    create: { nombre: NOMBRE, email: EMAIL, passwordHash, rolId: rol.id, sedeId: null, activo: true },
  });

  console.log("✅ Usuario listo:");
  console.log(`   Nombre: ${usuario.nombre}`);
  console.log(`   Email:  ${usuario.email}`);
  console.log(`   Clave:  ${CLAVE}   (cámbiala tras el primer ingreso)`);
  console.log(`   Rol:    ${ROL}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
