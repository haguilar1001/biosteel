// Exporta a Excel el facturado por proveedor con los filtros vigentes.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { detalleFacturas } from "@/lib/negocio/compras";
import { libroDescarga } from "@/lib/xlsx-export";
import { resolverFiltro, type ParamsCompras } from "../../_filtro";

const TOPE = 20_000;

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "compras.view"))) return new Response("No autorizado", { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams) as ParamsCompras;
  const c = await resolverFiltro(sp);
  if (!c) return new Response("Sin compras cargadas", { status: 404 });

  const filas = await detalleFacturas(c.filtro, TOPE);
  const cuerpo = filas.map((r) => [
    r.fecha.toISOString().slice(0, 10), r.nroDocumento, r.doctoProveedor, r.proveedor,
    r.claseDocto, r.estado, r.valorBruto, r.valorImptos, r.valorNeto,
    r.valorRetenciones, r.valorCxp, r.notas,
  ]);

  return libroDescarga({
    hoja: "Facturado proveedor",
    encabezado: ["Fecha", "Nro documento", "Docto. proveedor", "Proveedor", "Clase docto.",
      "Estado", "Valor bruto", "Valor imptos", "Valor neto", "Valor retenciones", "Valor CxP", "Notas"],
    filas: cuerpo,
    anchos: [12, 18, 20, 36, 24, 14, 16, 14, 16, 16, 16, 28],
    archivo: `facturado-proveedor-${c.query.replace(/[=&]/g, "-")}.xlsx`,
  });
}
