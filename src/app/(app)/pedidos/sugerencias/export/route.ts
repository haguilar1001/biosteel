// Exporta a Excel la sugerencia de compra con los parámetros vigentes.
// Sin recorte: la vista muestra 300 referencias, el Excel las trae todas, que
// es como se pasa la lista a Compras para armar las órdenes.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { libroDescarga } from "@/lib/xlsx-export";
import { resolverSugerencias, type ParamsSugerencias } from "../_params";

const fecha = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const dec = (v: number) => Math.round(v * 100) / 100;

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "pedidos.view"))) return new Response("No autorizado", { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams) as ParamsSugerencias;
  const c = await resolverSugerencias(sp);
  if (!c) return new Response("Sin pedidos cargados", { status: 404 });

  const filas = c.visibles.map((f) => [
    f.referencia, f.descripcion, f.proveedor, f.marca, f.linea, f.modelo, f.clase,
    f.consumo, f.mesesConConsumo, dec(f.cpm),
    f.existencia, f.enTransito, f.disponible,
    f.cobertura == null ? "" : dec(f.cobertura),
    dec(f.puntoReorden), f.sugerido, dec(f.costoUnitario), dec(f.valorSugerido),
    f.estado, fecha(f.ultimoPedido),
  ]);

  const p = c.parametros;
  return libroDescarga({
    hoja: "Sugerencia de compra",
    encabezado: [
      "Referencia", "Descripción", "Proveedor", "Marca", "Línea", "Modelo de compra", "ABC",
      `Consumo ${p.ventanaMeses}m`, "Meses con consumo", "Consumo mensual",
      "Existencia", "En tránsito", "Disponible", "Cobertura (meses)",
      "Punto de reorden", "Sugerido", "Costo unitario", "$ Sugerido",
      "Estado", "Último pedido",
    ],
    filas,
    anchos: [16, 44, 32, 22, 24, 18, 6, 12, 16, 14, 12, 12, 12, 15, 16, 10, 14, 16, 12, 12],
    archivo: `sugerencia-de-compra-${p.ventanaMeses}m-lt${p.leadTimeMeses}-cob${p.coberturaMeses}.xlsx`,
  });
}
