// Exporta la matriz proveedor × mes (facturado) en pesos COP, no en millones:
// la pantalla resume para que quepan las 12 columnas, el Excel no necesita.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { facturadoPorProveedorMes, MES_CORTO } from "@/lib/negocio/compras";
import { libroDescarga } from "@/lib/xlsx-export";
import { resolverFiltro, type ParamsCompras } from "../../_filtro";

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "compras.view"))) return new Response("No autorizado", { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams) as ParamsCompras;
  const c = await resolverFiltro(sp);
  if (!c) return new Response("Sin compras cargadas", { status: 404 });

  const { filas, totalMes, total } = await facturadoPorProveedorMes(c.filtro);
  const cuerpo: (string | number)[][] = filas.map((f) => [f.proveedor, f.tipoCompra, ...f.meses, f.total]);
  cuerpo.push(["TOTAL", "", ...totalMes, total]);

  const meses = MES_CORTO.slice(1);
  return libroDescarga({
    hoja: `Compras ${c.filtro.anio}`,
    encabezado: ["Proveedor", "Tipo de compra", ...meses, "Total"],
    filas: cuerpo,
    anchos: [36, 20, ...meses.map(() => 14), 16],
    archivo: `compras-por-proveedor-mes-${c.filtro.anio}.xlsx`,
  });
}
