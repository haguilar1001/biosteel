// Exporta a Excel el detalle de pedidos con los filtros vigentes.
// Sin recorte: la vista muestra 400 renglones, el Excel los trae todos.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { detallePedidos } from "@/lib/negocio/pedidos";
import { libroDescarga } from "@/lib/xlsx-export";
import { resolverFiltro, type ParamsPedidos } from "../../_filtro";

const TOPE = 60_000;
const fecha = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "pedidos.view"))) return new Response("No autorizado", { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams) as ParamsPedidos;
  const c = await resolverFiltro(sp);
  if (!c) return new Response("Sin pedidos cargados", { status: 404 });

  const filas = await detallePedidos(c.filtro, TOPE);
  const cuerpo = filas.map((r) => [
    fecha(r.fecha), r.nroDocumento, r.estado, r.bodegaDesc, r.referencia, r.descItem,
    r.cantPedida, r.costoProm, r.valorBruto, r.utilidad,
    r.marca, r.linea, r.anatomia, r.cliente, r.ciudad, r.proveedor, r.paciente, r.medico,
  ]);

  return libroDescarga({
    hoja: "Detalle de pedidos",
    encabezado: ["Fecha", "Nro documento", "Estado", "Desc. bodega", "Referencia", "Descripción",
      "Cant. pedida", "Costo promedio total", "Valor bruto", "Utilidad promedio",
      "Marca", "Línea", "Anatomía", "Cliente", "Ciudad", "Proveedor", "Paciente", "Médico"],
    filas: cuerpo,
    anchos: [12, 16, 16, 28, 18, 44, 12, 18, 16, 16, 24, 24, 22, 30, 16, 30, 34, 26],
    archivo: `detalle-pedidos-${c.query.replace(/[=&]/g, "-")}.xlsx`,
  });
}
