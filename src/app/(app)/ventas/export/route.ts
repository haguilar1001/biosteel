// Exporta a Excel las ventas por mes del año (vs año anterior, dif y % var).
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { ventaMensualDetalle, resumenAnual, aniosConVenta } from "@/lib/negocio/ventas";
import { libroDescarga } from "@/lib/xlsx-export";

const MES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "cxp.view"))) return new Response("No autorizado", { status: 403 });

  const anios = await aniosConVenta();
  const anioRaw = Number(req.nextUrl.searchParams.get("anio"));
  const anio = anios.includes(anioRaw) ? anioRaw : anios.length ? anios[anios.length - 1]! : new Date().getFullYear();

  const [act, ant, kpi] = await Promise.all([
    ventaMensualDetalle(anio), ventaMensualDetalle(anio - 1), resumenAnual(anio),
  ]);
  const totalAnt = ant.reduce((s, m) => s + m.venta, 0);

  const cuerpo: (string | number)[][] = [];
  for (const m of act) {
    const va = ant[m.mes - 1]!.venta;
    if (m.venta === 0 && va === 0) continue;
    const dif = m.venta - va;
    cuerpo.push([MES[m.mes]!, m.venta, va, dif, va > 0 ? Number(((dif / va) * 100).toFixed(2)) : ""]);
  }
  const difT = kpi.venta - totalAnt;
  cuerpo.push(["TOTAL", kpi.venta, totalAnt, difT, totalAnt > 0 ? Number(((difT / totalAnt) * 100).toFixed(2)) : ""]);

  return libroDescarga({
    hoja: `Ventas ${anio}`,
    encabezado: ["Mes", `Venta ${anio}`, `Venta ${anio - 1}`, "Dif. $", "% Var."],
    filas: cuerpo,
    anchos: [14, 18, 18, 18, 10],
    archivo: `ventas-por-mes-${anio}.xlsx`,
  });
}
