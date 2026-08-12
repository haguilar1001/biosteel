// Exporta a Excel las ventas por cliente del año (venta neta, costo, utilidad).
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { ventaPorCliente, resumenAnual, aniosConVenta } from "@/lib/negocio/ventas";
import { libroDescarga } from "@/lib/xlsx-export";

const pct = (parte: number, todo: number) => (todo > 0 ? Number(((parte / todo) * 100).toFixed(2)) : "");

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "cxp.view"))) return new Response("No autorizado", { status: 403 });

  const anios = await aniosConVenta();
  const anioRaw = Number(req.nextUrl.searchParams.get("anio"));
  const anio = anios.includes(anioRaw) ? anioRaw : anios.length ? anios[anios.length - 1]! : new Date().getFullYear();

  const [clientes, kpi] = await Promise.all([ventaPorCliente(anio), resumenAnual(anio)]);
  const cuerpo: (string | number)[][] = clientes.map((c) => {
    const util = c.valor - c.costo;
    return [c.clienteNombre, c.nit ?? "", c.valor, pct(c.valor, kpi.venta), c.costo, util, pct(util, c.valor)];
  });
  cuerpo.push(["TOTAL", "", kpi.venta, kpi.venta > 0 ? 100 : "", kpi.costo, kpi.utilidad, pct(kpi.utilidad, kpi.venta)]);

  return libroDescarga({
    hoja: `Ventas cliente ${anio}`,
    encabezado: ["Cliente", "NIT", "Venta neta", "% Part.", "Costo", "Utilidad", "% Util."],
    filas: cuerpo,
    anchos: [40, 14, 18, 10, 18, 18, 10],
    archivo: `ventas-por-cliente-${anio}.xlsx`,
  });
}
