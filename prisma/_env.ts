// Carga el archivo .env para los scripts de importación. Ni tsx ni el
// cliente Prisma leen .env por su cuenta (solo lo hace el CLI de Prisma),
// así que lo cargamos aquí antes de instanciar PrismaClient.
// Debe importarse como PRIMERA línea del script.
import fs from "node:fs";

for (const archivo of [".env.local", ".env"]) {
  try {
    if (fs.existsSync(archivo)) {
      (process as NodeJS.Process & { loadEnvFile: (p?: string) => void }).loadEnvFile(archivo);
    }
  } catch {
    // silencioso: si no existe o falla, se usa el entorno actual
  }
}
