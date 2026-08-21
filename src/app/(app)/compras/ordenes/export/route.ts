// Exporta a Excel el detalle de órdenes de compra con los filtros vigentes.
// Sin recorte: la vista muestra 300 renglones, el Excel los trae todos.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { detalleOrdenes } from "@/lib/negocio/compras";
import { libroDescarga } from "@/lib/xlsx-export";
import { resolverFiltro, type ParamsCompras } from "../../_filtro";

const TOPE = 60_000;
const fecha = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "compras.view"))) return new Response("No autorizado", { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams) as ParamsCompras;
  const c = await resolverFiltro(sp);
  if (!c) return new Response("Sin compras cargadas", { status: 404 });

  const filas = await detalleOrdenes(c.filtro, TOPE);
  const cuerpo = filas.map((r) => [
    fecha(r.fechaOrden), r.nroOrden, r.proveedor, r.bodegaCodigo, r.bodegaDesc,
    r.referencia, r.descItem, r.cantOrdenada, r.valorNeto, r.estado, r.linea, r.marca,
  ]);

  return libroDescarga({
    hoja: "Órdenes de compra",
    encabezado: ["Fecha orden", "Nro orden", "Proveedor", "Bodega", "Desc. bodega",
      "Referencia", "Desc. item", "Cant. ordenada", "Valor neto", "Estado", "Línea", "Marca"],
    filas: cuerpo,
    anchos: [12, 16, 34, 10, 28, 20, 40, 12, 16, 14, 24, 22],
    archivo: `ordenes-de-compra-${c.query.replace(/[=&]/g, "-")}.xlsx`,
  });
}
