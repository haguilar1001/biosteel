// ==========================================================
// Seed de DEMOSTRACIÓN — datos 100% FICTICIOS
// Sirve para ver las pantallas funcionando durante el desarrollo.
// NO son datos reales de BioSteel (regla del PRD: no cargar datos
// reales hasta verificar el baseline P0).
// Idempotente: upserts por clave natural. Ejecutar: npm run db:seed:demo
// ==========================================================
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HOY = new Date();
function diaRelativo(dias: number): Date {
  const d = new Date(HOY);
  d.setDate(d.getDate() + dias);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🎭 Sembrando datos de DEMOSTRACIÓN (ficticios)...");

  // --- Sedes existentes ---
  const sedes = await prisma.sede.findMany();
  const sedeBaq = sedes.find((s) => s.ciudad === "Barranquilla") ?? sedes[0];
  const sedeCali = sedes.find((s) => s.ciudad === "Cali") ?? sedes[0];
  const sedeSm = sedes.find((s) => s.ciudad === "Santa Marta") ?? sedes[0];
  if (!sedeBaq || !sedeCali || !sedeSm) {
    throw new Error("Faltan sedes base. Corre 'npm run db:seed' antes del seed de demo.");
  }

  // --- TRM del día (USD) ---
  await prisma.tasaCambio.upsert({
    where: { monedaCodigo_fecha: { monedaCodigo: "USD", fecha: diaRelativo(0) } },
    update: { valorCop: "4180.5000" },
    create: { monedaCodigo: "USD", fecha: diaRelativo(0), valorCop: "4180.5000" },
  });

  // --- Vendedores ---
  async function upsertVendedor(nombre: string) {
    const existe = await prisma.vendedor.findFirst({ where: { nombre } });
    return existe ?? prisma.vendedor.create({ data: { nombre } });
  }
  const laura = await upsertVendedor("Laura Martínez");
  const andres = await upsertVendedor("Andrés Ríos");
  const carolina = await upsertVendedor("Carolina Peña");

  // --- Clientes (terceros + perfil) ---
  interface DefCliente {
    nit: string;
    nombre: string;
    categoria: "clinica_ips" | "eps_aseguradora" | "distribuidor" | "cirujano_particular";
    ciudad: string;
    tipoPersona?: "natural" | "juridica";
    vendedorId: number;
    cupo: number;
    dias: number;
  }
  const clientes: DefCliente[] = [
    { nit: "890100001-1", nombre: "Clínica del Caribe S.A.S", categoria: "clinica_ips", ciudad: "Barranquilla", vendedorId: laura.id, cupo: 500_000_000, dias: 60 },
    { nit: "890100002-2", nombre: "Clínica Portoazul S.A.", categoria: "clinica_ips", ciudad: "Barranquilla", vendedorId: laura.id, cupo: 400_000_000, dias: 60 },
    { nit: "830100003-3", nombre: "Nueva EPS S.A.", categoria: "eps_aseguradora", ciudad: "Bogotá", vendedorId: carolina.id, cupo: 800_000_000, dias: 90 },
    { nit: "805000004-4", nombre: "Coomeva EPS", categoria: "eps_aseguradora", ciudad: "Cali", vendedorId: carolina.id, cupo: 600_000_000, dias: 90 },
    { nit: "900200005-5", nombre: "Distribuidora Ortopédica Andina", categoria: "distribuidor", ciudad: "Cali", vendedorId: andres.id, cupo: 300_000_000, dias: 45 },
    { nit: "890200006-6", nombre: "Hospital Universitario del Valle", categoria: "clinica_ips", ciudad: "Cali", vendedorId: andres.id, cupo: 350_000_000, dias: 60 },
    { nit: "819000007-7", nombre: "Clínica Bahía Santa Marta", categoria: "clinica_ips", ciudad: "Santa Marta", vendedorId: laura.id, cupo: 250_000_000, dias: 45 },
    { nit: "12345678-9", nombre: "Dr. Fernando Gómez (Cirujano)", categoria: "cirujano_particular", ciudad: "Barranquilla", tipoPersona: "natural", vendedorId: laura.id, cupo: 80_000_000, dias: 30 },
  ];

  const idCliente = new Map<string, number>();
  for (const c of clientes) {
    const tercero = await prisma.tercero.upsert({
      where: { nit: c.nit },
      update: { nombre: c.nombre, esCliente: true },
      create: {
        nit: c.nit,
        nombre: c.nombre,
        tipoPersona: c.tipoPersona ?? "juridica",
        ciudad: c.ciudad,
        esCliente: true,
      },
    });
    await prisma.clientePerfil.upsert({
      where: { terceroId: tercero.id },
      update: { categoria: c.categoria, vendedorId: c.vendedorId, cupoCredito: c.cupo, diasCredito: c.dias },
      create: { terceroId: tercero.id, categoria: c.categoria, vendedorId: c.vendedorId, cupoCredito: c.cupo, diasCredito: c.dias },
    });
    idCliente.set(c.nit, tercero.id);
  }

  // --- Proveedores (terceros + perfil) ---
  const proveedores = [
    { nit: "AT-SYN-001", nombre: "Synthes GmbH", tipo: "importado" as const, moneda: "USD", ciudad: "Zúrich" },
    { nit: "AT-STR-002", nombre: "Stryker Corporation", tipo: "importado" as const, moneda: "USD", ciudad: "Michigan" },
    { nit: "900300010-1", nombre: "Instrumental Andino S.A.S", tipo: "nacional" as const, moneda: "COP", ciudad: "Bogotá" },
    { nit: "900300011-2", nombre: "Aceros Quirúrgicos de Colombia", tipo: "nacional" as const, moneda: "COP", ciudad: "Medellín" },
  ];
  const idProveedor = new Map<string, number>();
  for (const p of proveedores) {
    const tercero = await prisma.tercero.upsert({
      where: { nit: p.nit },
      update: { nombre: p.nombre, esProveedor: true },
      create: { nit: p.nit, nombre: p.nombre, tipoPersona: "juridica", ciudad: p.ciudad, esProveedor: true },
    });
    await prisma.proveedorPerfil.upsert({
      where: { terceroId: tercero.id },
      update: { tipo: p.tipo, monedaDefault: p.moneda },
      create: { terceroId: tercero.id, tipo: p.tipo, monedaDefault: p.moneda, diasCredito: 30 },
    });
    idProveedor.set(p.nit, tercero.id);
  }

  // --- Facturas de venta (cartera) con antigüedades variadas ---
  // vence: días relativos a hoy (negativo = ya venció → aging)
  interface DefFactura {
    numero: string; nit: string; sedeId: number; vendedorId: number;
    valor: number; saldo: number; vence: number; estado: "corriente" | "vencida" | "abonada_parcial" | "en_glosa";
  }
  const facturas: DefFactura[] = [
    // Corriente (aún por vencer o < 30 vencida)
    { numero: "FV-2026-0412", nit: "890100001-1", sedeId: sedeBaq.id, vendedorId: laura.id, valor: 45_000_000, saldo: 45_000_000, vence: 15, estado: "corriente" },
    { numero: "FV-2026-0410", nit: "890100002-2", sedeId: sedeBaq.id, vendedorId: laura.id, valor: 62_000_000, saldo: 62_000_000, vence: 8, estado: "corriente" },
    { numero: "FV-2026-0408", nit: "830100003-3", sedeId: sedeBaq.id, vendedorId: carolina.id, valor: 120_000_000, saldo: 120_000_000, vence: -12, estado: "corriente" },
    { numero: "FV-2026-0405", nit: "900200005-5", sedeId: sedeCali.id, vendedorId: andres.id, valor: 38_500_000, saldo: 20_000_000, vence: 20, estado: "abonada_parcial" },
    // 31–60
    { numero: "FV-2026-0388", nit: "890100001-1", sedeId: sedeBaq.id, vendedorId: laura.id, valor: 52_500_000, saldo: 52_500_000, vence: -45, estado: "vencida" },
    { numero: "FV-2026-0385", nit: "805000004-4", sedeId: sedeCali.id, vendedorId: carolina.id, valor: 95_000_000, saldo: 95_000_000, vence: -38, estado: "vencida" },
    { numero: "FV-2026-0380", nit: "890200006-6", sedeId: sedeCali.id, vendedorId: andres.id, valor: 41_000_000, saldo: 41_000_000, vence: -52, estado: "vencida" },
    // 61–90
    { numero: "FV-2026-0355", nit: "830100003-3", sedeId: sedeBaq.id, vendedorId: carolina.id, valor: 78_000_000, saldo: 78_000_000, vence: -75, estado: "vencida" },
    { numero: "FV-2026-0350", nit: "819000007-7", sedeId: sedeSm.id, vendedorId: laura.id, valor: 33_200_000, saldo: 33_200_000, vence: -68, estado: "vencida" },
    // +90
    { numero: "FV-2026-0301", nit: "805000004-4", sedeId: sedeCali.id, vendedorId: carolina.id, valor: 110_000_000, saldo: 110_000_000, vence: -120, estado: "en_glosa" },
    { numero: "FV-2026-0298", nit: "890100002-2", sedeId: sedeBaq.id, vendedorId: laura.id, valor: 64_350_000, saldo: 64_350_000, vence: -145, estado: "vencida" },
    { numero: "FV-2026-0290", nit: "12345678-9", sedeId: sedeBaq.id, vendedorId: laura.id, valor: 18_000_000, saldo: 18_000_000, vence: -98, estado: "vencida" },
    { numero: "FV-2026-0285", nit: "890200006-6", sedeId: sedeCali.id, vendedorId: andres.id, valor: 47_800_000, saldo: 47_800_000, vence: -110, estado: "vencida" },
  ];

  for (const f of facturas) {
    const vencimiento = diaRelativo(f.vence);
    const emision = diaRelativo(f.vence - 45);
    const terceroId = idCliente.get(f.nit)!;
    await prisma.facturaVenta.upsert({
      where: { numero: f.numero },
      update: { saldo: f.saldo, estado: f.estado },
      create: {
        numero: f.numero,
        terceroId,
        sedeId: f.sedeId,
        vendedorId: f.vendedorId,
        origen: "directa",
        fechaEmision: emision,
        fechaVencimiento: vencimiento,
        moneda: "COP",
        valorTotal: f.valor,
        iva: Math.round(f.valor * 0.19),
        saldo: f.saldo,
        estado: f.estado,
      },
    });
  }

  // --- Glosa de ejemplo sobre la factura en_glosa ---
  const facturaGlosa = await prisma.facturaVenta.findUnique({ where: { numero: "FV-2026-0301" } });
  if (facturaGlosa) {
    const yaTiene = await prisma.glosa.findFirst({ where: { facturaId: facturaGlosa.id } });
    if (!yaTiene) {
      await prisma.glosa.create({
        data: { facturaId: facturaGlosa.id, valor: 22_000_000, estado: "abierta", descripcion: "Glosa por soporte de autorización (demo)", fecha: diaRelativo(-30) },
      });
    }
  }

  // --- Documentos por pagar (CxP), COP y USD ---
  const TRM = 4180.5;
  interface DefDoc {
    numero: string; nitProv: string; moneda: string; valorOrigen: number; saldoRatio: number; vence: number;
    tipo: "nacional" | "importado";
  }
  const docs: DefDoc[] = [
    { numero: "INV-SYN-8841", nitProv: "AT-SYN-001", moneda: "USD", valorOrigen: 42_000, saldoRatio: 1, vence: 25, tipo: "importado" },
    { numero: "INV-SYN-8802", nitProv: "AT-SYN-001", moneda: "USD", valorOrigen: 38_400, saldoRatio: 1, vence: -10, tipo: "importado" },
    { numero: "INV-STR-5521", nitProv: "AT-STR-002", moneda: "USD", valorOrigen: 88_000, saldoRatio: 0.5, vence: 5, tipo: "importado" },
    { numero: "FC-IA-2201", nitProv: "900300010-1", moneda: "COP", valorOrigen: 145_000_000, saldoRatio: 1, vence: 12, tipo: "nacional" },
    { numero: "FC-IA-2180", nitProv: "900300010-1", moneda: "COP", valorOrigen: 96_750_000, saldoRatio: 1, vence: 4, tipo: "nacional" },
    { numero: "FC-AQ-3390", nitProv: "900300011-2", moneda: "COP", valorOrigen: 214_300_000, saldoRatio: 1, vence: -18, tipo: "nacional" },
    { numero: "FC-AQ-3375", nitProv: "900300011-2", moneda: "COP", valorOrigen: 72_500_000, saldoRatio: 1, vence: 30, tipo: "nacional" },
  ];

  for (const d of docs) {
    const trm = d.moneda === "USD" ? TRM : 1;
    const valorCop = Math.round(d.valorOrigen * trm);
    const saldo = Math.round(valorCop * d.saldoRatio);
    const proveedorId = idProveedor.get(d.nitProv)!;
    const vencimiento = diaRelativo(d.vence);
    const estado = d.vence < 0 ? "vencido" : d.vence <= 7 ? "proximo_vencer" : "vigente";
    await prisma.documentoCxp.upsert({
      where: { numero_proveedorId: { numero: d.numero, proveedorId } },
      update: { saldo, estado },
      create: {
        numero: d.numero,
        proveedorId,
        moneda: d.moneda,
        valorOrigen: d.valorOrigen,
        trmCausacion: trm,
        valorCop,
        saldo,
        fechaEmision: diaRelativo(d.vence - 30),
        fechaVencimiento: vencimiento,
        tipo: d.tipo,
        estado,
      },
    });
  }

  const nF = await prisma.facturaVenta.count();
  const nD = await prisma.documentoCxp.count();
  const nT = await prisma.tercero.count();
  console.log(`✅ Demo lista: ${nT} terceros, ${nF} facturas, ${nD} documentos CxP.`);
}

main()
  .catch((e) => {
    console.error("❌ Error en el seed de demo:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
