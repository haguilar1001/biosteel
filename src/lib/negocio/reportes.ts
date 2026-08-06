// ==========================================================
// Lógica de reportes: recaudo por vendedor, antigüedad promedio
// por tipo de cliente y efectividad de recaudo mensual.
// Respeta el alcance del usuario (anti-IDOR) en las consultas de cartera.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import type { UsuarioConRol } from "@/lib/auth/session";
import type { Alcance } from "@/lib/rbac/permissions";
import { filtroFacturas } from "@/lib/rbac/authorize";
import { diasVencido } from "./aging";

export interface FilaVendedor {
  vendedor: string;
  carteraAsignada: number;
  recaudado: number;
  efectividad: number; // 0–100
}

/** Recaudo del período por vendedor vs. su cartera vigente. */
export async function recaudoPorVendedor(
  usuario: UsuarioConRol,
  alcance: Alcance,
  desde: Date,
): Promise<FilaVendedor[]> {
  const facturaWhere = filtroFacturas(usuario, alcance);

  const [facturas, aplicaciones] = await Promise.all([
    prisma.facturaVenta.findMany({
      where: { ...facturaWhere, saldo: { gt: 0 }, estado: { not: "cancelada" }, vendedorId: { not: null } },
      select: { saldo: true, vendedorId: true, vendedor: { select: { nombre: true } } },
    }),
    prisma.recaudoAplicacion.findMany({
      where: { recaudo: { fecha: { gte: desde } }, factura: { ...facturaWhere, vendedorId: { not: null } } },
      select: { valorAplicado: true, factura: { select: { vendedorId: true, vendedor: { select: { nombre: true } } } } },
    }),
  ]);

  const mapa = new Map<number, { vendedor: string; cartera: number; recaudado: number }>();
  for (const f of facturas) {
    const id = f.vendedorId!;
    const e = mapa.get(id) ?? { vendedor: f.vendedor?.nombre ?? "—", cartera: 0, recaudado: 0 };
    e.cartera += f.saldo.toNumber();
    mapa.set(id, e);
  }
  for (const a of aplicaciones) {
    const id = a.factura.vendedorId!;
    const e = mapa.get(id) ?? { vendedor: a.factura.vendedor?.nombre ?? "—", cartera: 0, recaudado: 0 };
    e.recaudado += a.valorAplicado.toNumber();
    mapa.set(id, e);
  }

  return [...mapa.values()]
    .map((e) => ({
      vendedor: e.vendedor,
      carteraAsignada: e.cartera,
      recaudado: e.recaudado,
      efectividad: e.cartera + e.recaudado > 0 ? (e.recaudado / (e.cartera + e.recaudado)) * 100 : 0,
    }))
    .sort((a, b) => b.recaudado - a.recaudado);
}

export interface FilaCategoria {
  categoria: string;
  diasPromedio: number;
  saldo: number;
}

const CAT_LABEL: Record<string, string> = {
  clinica_ips: "Clínicas / IPS",
  eps_aseguradora: "EPS / Aseguradoras",
  distribuidor: "Distribuidores",
  cirujano_particular: "Cirujanos",
};

/** Antigüedad promedio (ponderada por saldo) de la cartera por tipo de cliente. */
export async function diasPromedioPorCategoria(
  usuario: UsuarioConRol,
  alcance: Alcance,
  corte: Date = new Date(),
): Promise<FilaCategoria[]> {
  const facturas = await prisma.facturaVenta.findMany({
    where: { ...filtroFacturas(usuario, alcance), saldo: { gt: 0 }, estado: { not: "cancelada" } },
    select: { saldo: true, fechaVencimiento: true, tercero: { select: { clientePerfil: { select: { categoria: true } } } } },
  });

  const mapa = new Map<string, { saldo: number; ponderado: number }>();
  for (const f of facturas) {
    const cat = f.tercero.clientePerfil?.categoria ?? "sin_categoria";
    const saldo = f.saldo.toNumber();
    const dias = Math.max(0, diasVencido(f.fechaVencimiento, corte));
    const e = mapa.get(cat) ?? { saldo: 0, ponderado: 0 };
    e.saldo += saldo;
    e.ponderado += dias * saldo;
    mapa.set(cat, e);
  }

  return [...mapa.entries()]
    .map(([cat, e]) => ({
      categoria: CAT_LABEL[cat] ?? cat,
      diasPromedio: e.saldo > 0 ? Math.round(e.ponderado / e.saldo) : 0,
      saldo: e.saldo,
    }))
    .sort((a, b) => b.saldo - a.saldo);
}

export interface FilaMes {
  etiqueta: string;
  monto: number;
}

/** Recaudo total por mes en los últimos `meses` meses (incluye el actual). */
export async function recaudoMensual(meses = 6, hoy: Date = new Date()): Promise<FilaMes[]> {
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1);
  const recaudos = await prisma.recaudo.findMany({
    where: { fecha: { gte: desde } },
    select: { fecha: true, valorRecibido: true },
  });

  const NOMBRE = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const buckets: FilaMes[] = [];
  const indice = new Map<string, number>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1) + i, 1);
    const clave = `${d.getFullYear()}-${d.getMonth()}`;
    indice.set(clave, buckets.length);
    buckets.push({ etiqueta: `${NOMBRE[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, monto: 0 });
  }

  for (const r of recaudos) {
    const clave = `${r.fecha.getFullYear()}-${r.fecha.getMonth()}`;
    const i = indice.get(clave);
    if (i != null) buckets[i]!.monto += r.valorRecibido.toNumber();
  }
  return buckets;
}
