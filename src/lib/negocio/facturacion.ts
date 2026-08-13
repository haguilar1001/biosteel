// ==========================================================
// Consultas de los tableros de facturación (módulo PENDIENTES, Fase 3):
//   · Facturación por usuario  (FacturacionDoc)
//   · Facturas anuladas por motivo / responsable  (FacturaAnulada)
//   · Gastos: tiempo de facturación 0–3 días, cumplidos, facturado vs gastos
// Fórmulas según el Word de medidas DAX (ver modulo-pendientes en memoria).
// ==========================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Estados de un gasto "pendiente" (DAX: Estado IN {...}).
const ESTADOS_PENDIENTE = new Set(["comprometido", "aprobado", "en elaboracion", "retenido"]);
const esCumplido = (e: string) => e.trim().toLowerCase() === "cumplido";
const esPendiente = (e: string) => ESTADOS_PENDIENTE.has(e.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase());

function whereMeses(anio: number, meses?: number[]): { anio: number; mes?: { in: number[] } } {
  return { anio, ...(meses && meses.length ? { mes: { in: meses } } : {}) };
}

/** Años con facturación o gastos cargados (asc). */
export async function aniosFacturacion(): Promise<number[]> {
  const [f, g] = await Promise.all([
    prisma.facturacionDoc.groupBy({ by: ["anio"], _count: { _all: true } }),
    prisma.gastoDoc.groupBy({ by: ["anio"], _count: { _all: true } }),
  ]);
  return [...new Set([...f.map((x) => x.anio), ...g.map((x) => x.anio)])].sort((a, b) => a - b);
}

// ---------- Venta por día (facturación FET) ----------

export interface VentaDia { dia: number; venta: number; }

/** Venta (Σ subtotal FET) por día del mes indicado, ascendente. */
export async function ventaFacturacionPorDia(anio: number, mes: number): Promise<VentaDia[]> {
  const grupos = await prisma.facturacionDoc.groupBy({ by: ["fecha"], where: { anio, mes }, _sum: { subtotal: true } });
  return grupos
    .map((g) => ({ dia: g.fecha.getUTCDate(), venta: g._sum.subtotal?.toNumber() ?? 0 }))
    .sort((a, b) => a.dia - b.dia);
}

// ---------- Facturación por usuario ----------

export interface UsuarioFact { usuario: string; docs: number; valor: number; }
export interface ResumenFacturacion { docs: number; valor: number; usuarios: UsuarioFact[]; }

export async function facturacionPorUsuario(anio: number, meses?: number[]): Promise<ResumenFacturacion> {
  const where = whereMeses(anio, meses);
  const grupos = await prisma.facturacionDoc.groupBy({ by: ["usuarioAprobacion"], where, _count: { _all: true }, _sum: { subtotal: true } });
  const usuarios = grupos
    .map((g) => ({ usuario: g.usuarioAprobacion || "(en blanco)", docs: g._count._all, valor: g._sum.subtotal?.toNumber() ?? 0 }))
    .sort((a, b) => b.docs - a.docs);
  return { docs: usuarios.reduce((s, u) => s + u.docs, 0), valor: usuarios.reduce((s, u) => s + u.valor, 0), usuarios };
}

// ---------- Facturas anuladas ----------

export interface AgrupAnulada { clave: string; count: number; valor: number; }
export interface ResumenAnuladas { count: number; valor: number; porMotivo: AgrupAnulada[]; porResponsable: AgrupAnulada[]; }

export async function anuladasResumen(anio: number, meses?: number[]): Promise<ResumenAnuladas> {
  const where = whereMeses(anio, meses);
  const [porMot, porResp, tot] = await Promise.all([
    prisma.facturaAnulada.groupBy({ by: ["motivo"], where, _count: { _all: true }, _sum: { subtotal: true } }),
    prisma.facturaAnulada.groupBy({ by: ["responsable"], where, _count: { _all: true }, _sum: { subtotal: true } }),
    prisma.facturaAnulada.aggregate({ where, _count: { _all: true }, _sum: { subtotal: true } }),
  ]);
  // Fusiona grupos que solo difieren en mayúsculas/acentos (p. ej. "Cliente"/"cliente").
  const claveNorm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const canon = (s: string) => { const t = s.trim(); return /[A-ZÁÉÍÓÚÑ]/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1); };
  const mapa = (rows: { motivo?: string | null; responsable?: string | null; _count: { _all: number }; _sum: { subtotal: Prisma.Decimal | null } }[], campo: "motivo" | "responsable"): AgrupAnulada[] => {
    const m = new Map<string, AgrupAnulada>();
    for (const r of rows) {
      const raw = (r[campo] ?? "(sin dato)") || "(sin dato)";
      const k = claveNorm(raw);
      const cur = m.get(k) ?? { clave: canon(raw), count: 0, valor: 0 };
      cur.count += r._count._all;
      cur.valor += r._sum.subtotal?.toNumber() ?? 0;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  };
  return {
    count: tot._count._all,
    valor: tot._sum.subtotal?.toNumber() ?? 0,
    porMotivo: mapa(porMot, "motivo"),
    porResponsable: mapa(porResp, "responsable"),
  };
}

// ---------- Gastos: indicadores mensuales ----------

export interface GastoMes {
  mes: number;
  nGastos: number;          // # Gastos (COUNT)
  vrGastos: number;         // Σ subtotal gastos
  nFacturasMes: number;     // gastos con Estado = Cumplido
  vrFacturaMes: number;     // Σ subtotal de gastos CUMPLIDOS (= "facturado")
  cumpl03: number;          // TimpoFacturado2 0–3
  cumpl47: number;          // 4–7
  cumpl8: number;           // >=8
  pendientes: number;       // Estado IN pendiente
  vrPendientes: number;
  notasAnulacion: number;   // # NAN del mes
  // derivados
  pctCumplido: number;      // cumpl03 / nGastos  (meta >=75%)
  pctValor: number;         // vrFacturaMes / vrGastos (meta >=90%)
  pctCantidad: number;      // nFacturasMes / nGastos
  pctAnuladas: number;      // notasAnulacion / nFacturasMes (meta <=1%)
}

/** Todos los indicadores mensuales de gastos/facturación/anuladas del año. */
export async function gastosPorMes(anio: number): Promise<GastoMes[]> {
  const [gastos, anulMes] = await Promise.all([
    prisma.gastoDoc.findMany({ where: { anio }, select: { mes: true, estado: true, subtotal: true, diasFacturacion: true } }),
    prisma.facturaAnulada.groupBy({ by: ["mes"], where: { anio }, _count: { _all: true } }),
  ]);

  const anuMap = new Map(anulMes.map((a) => [a.mes, a._count._all]));

  const acc = new Map<number, GastoMes>();
  const get = (m: number): GastoMes => {
    let g = acc.get(m);
    if (!g) {
      g = { mes: m, nGastos: 0, vrGastos: 0, nFacturasMes: 0, vrFacturaMes: 0, cumpl03: 0, cumpl47: 0, cumpl8: 0, pendientes: 0, vrPendientes: 0, notasAnulacion: anuMap.get(m) ?? 0, pctCumplido: 0, pctValor: 0, pctCantidad: 0, pctAnuladas: 0 };
      acc.set(m, g);
    }
    return g;
  };

  for (const r of gastos) {
    const g = get(r.mes);
    const st = r.subtotal.toNumber();
    g.nGastos += 1;
    g.vrGastos += st;
    if (esCumplido(r.estado)) { g.nFacturasMes += 1; g.vrFacturaMes += st; }
    if (esPendiente(r.estado)) { g.pendientes += 1; g.vrPendientes += st; }
    // TimpoFacturado2 (DAX): buckets sobre todas las filas con día calculado, t>=0.
    const t = r.diasFacturacion;
    if (t != null) {
      if (t >= 0 && t <= 3) g.cumpl03 += 1;
      else if (t >= 4 && t <= 7) g.cumpl47 += 1;
      else if (t >= 8) g.cumpl8 += 1;
    }
  }

  const arr = [...acc.values()].sort((a, b) => a.mes - b.mes);
  for (const g of arr) {
    g.pctCumplido = g.nGastos ? (g.cumpl03 / g.nGastos) * 100 : 0;
    g.pctValor = g.vrGastos ? (g.vrFacturaMes / g.vrGastos) * 100 : 0;
    g.pctCantidad = g.nGastos ? (g.nFacturasMes / g.nGastos) * 100 : 0;
    g.pctAnuladas = g.nFacturasMes ? (g.notasAnulacion / g.nFacturasMes) * 100 : 0;
  }
  return arr;
}
