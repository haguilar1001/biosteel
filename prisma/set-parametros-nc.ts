// ==========================================================
// Siembra los Parámetros de Notas Crédito (IPS · Concepto · Pct · vigencia)
// desde "Parametros Nota Crédito.xlsx" a la tabla ParametroNotaCredito.
// Reemplaza todo (delete + recreate). Se corre local contra Railway.
//
// Uso:  npm run db:params-nc
//       RUTA_PARAMS_NC="D:/otra/ruta.xlsx" npm run db:params-nc
// ==========================================================
import "./_env";
import { PrismaClient, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();
const RUTA = process.env.RUTA_PARAMS_NC ?? "D:/Escritorio/Parametros Nota Crédito.xlsx";

/** "DD/MM/AAAA" → Date (UTC medianoche). */
function parseDMY(s: unknown): Date | null {
  const m = String(s ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  let y = Number(m[3]); if (y < 100) y += 2000;
  return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
}

async function main() {
  console.log(`📗 Leyendo parámetros NC desde: ${RUTA}`);
  const wb = XLSX.readFile(RUTA);
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: null });

  const data: { ips: string; concepto: string; pct: Prisma.Decimal; fechaInicio: Date; fechaFin: Date }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    if (!r || r[0] == null || String(r[0]).trim() === "") continue;
    const ini = parseDMY(r[3]), fin = parseDMY(r[4]);
    const pct = Number(r[2]);
    if (!ini || !fin || !isFinite(pct)) { console.warn(`   ⚠ Fila ${i} inválida, se omite:`, JSON.stringify(r)); continue; }
    data.push({
      ips: String(r[0]).trim(),
      concepto: String(r[1]).trim(),
      pct: new Prisma.Decimal(pct),
      fechaInicio: ini,
      fechaFin: fin,
    });
  }

  await prisma.$transaction([
    prisma.parametroNotaCredito.deleteMany({}),
    prisma.parametroNotaCredito.createMany({ data }),
  ]);

  console.log(`✅ Parámetros NC sembrados: ${data.length} filas.`);
}

main()
  .catch((e) => { console.error("❌ Error sembrando parámetros NC:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
