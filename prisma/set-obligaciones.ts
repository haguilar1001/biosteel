// ==========================================================
// Parámetro: Obligaciones Financieras (créditos, leasing, tarjetas).
// Datos extraídos de los planes de amortización (carpeta Obligaciones).
// Editable: ajusta los valores y vuelve a correr.  npm run db:obligaciones
// ==========================================================
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const d = (s: string) => new Date(s + "T00:00:00");

const OBLIGACIONES = [
  {
    entidad: "Bancolombia — FNG", tipo: "credito_fng", numero: "FNG-206829",
    montoInicial: "110836493", saldoCapital: "110836493", tasaEA: "13.80",
    cuotaMensual: "7930969", diaPago: 13, fechaVencimiento: d("2027-04-13"), corte: d("2026-03-27"),
    notas: "Crédito reestructurado FNG (12 cuotas). Ref. pago 9002300406.",
  },
  {
    entidad: "Bancolombia", tipo: "credito", numero: "111000242717",
    montoInicial: "400000000", saldoCapital: "156888657", tasaEA: "23.58",
    cuotaMensual: "6498620", diaPago: 16, fechaDesembolso: d("2023-11-16"), fechaVencimiento: d("2029-03-16"),
    notas: "Crédito comercial. Saldo a 16-jul-2026.",
  },
  {
    entidad: "Bancolombia — Leasing", tipo: "leasing", numero: "296446",
    saldoCapital: "372428030", tasaEA: "18.20", cuotaMensual: "11196432", diaPago: 19,
    fechaVencimiento: d("2032-05-19"),
    notas: "70 cánones pendientes + opción de compra $6.340.000.",
  },
  {
    entidad: "Banco Serfinanza", tipo: "tarjeta", numero: "SERFINANZA-MC",
    saldoCapital: "20673079.53", cuotaMensual: "7400812.63", tasaEA: "28.73",
    diaPago: 3, corte: d("2026-07-15"),
    notas: "Tarjeta empresarial Mastercard. Pago total $20.673.079,53 · pago mínimo $7.400.812,63 · fecha límite día 3 · corte 15/07/2026.",
  },
];

async function main() {
  for (const o of OBLIGACIONES) {
    await prisma.obligacionFinanciera.upsert({
      where: { numero: o.numero },
      update: o,
      create: o,
    });
  }
  const n = await prisma.obligacionFinanciera.count();
  const total = await prisma.obligacionFinanciera.aggregate({ _sum: { saldoCapital: true } });
  console.log(`✅ ${n} obligaciones cargadas. Saldo total $ ${Math.round(Number(total._sum.saldoCapital)).toLocaleString("es-CO")}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
