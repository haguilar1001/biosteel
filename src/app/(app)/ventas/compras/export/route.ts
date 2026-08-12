// Exporta a Excel la matriz de compras por proveedor × mes (facturado CxP),
// en pesos COP. Excluye internos (igual que la vista).
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { comprasPorProveedorMes } from "@/lib/negocio/cxp";
import { aniosConVenta } from "@/lib/negocio/ventas";
import { libroDescarga } from "@/lib/xlsx-export";

const MES_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "cxp.view"))) return new Response("No autorizado", { status: 403 });

  const aniosV = await aniosConVenta();
  const anioActual = new Date().getUTCFullYear();
  const anioRaw = req.nextUrl.searchParams.get("anio");
  const anio = anioRaw && /^\d{4}$/.test(anioRaw) ? Number(anioRaw) : (aniosV[aniosV.length - 1] ?? anioActual);

  const { filas, totalMes, total } = await comprasPorProveedorMes(anio);
  const cuerpo: (string | number)[][] = filas.map((f) => [f.proveedor, f.nit ?? "", ...f.meses, f.total]);
  cuerpo.push(["TOTAL", "", ...totalMes, total]);

  return libroDescarga({
    hoja: `Compras ${anio}`,
    encabezado: ["Proveedor", "NIT", ...MES_ABBR, "Total"],
    filas: cuerpo,
    anchos: [34, 14, ...MES_ABBR.map(() => 12), 16],
    archivo: `compras-por-proveedor-mes-${anio}.xlsx`,
  });
}
