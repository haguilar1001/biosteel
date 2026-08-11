// Exporta a Excel el detalle de cartera (CxC) respetando el alcance RBAC
// y los filtros de la URL (edad/aging, búsqueda).
import type { NextRequest } from "next/server";
import { getUsuarioActual } from "@/lib/auth/current-user";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { exportarFacturas } from "@/lib/negocio/cartera";
import { CUBETAS, type CubetaAging } from "@/lib/negocio/aging";
import { libroDescarga } from "@/lib/xlsx-export";
import { formatFecha } from "@/lib/format";

export async function GET(req: NextRequest) {
  const usuario = await getUsuarioActual();
  if (!usuario) return new Response("No autenticado", { status: 401 });
  let alcance;
  try {
    alcance = await exigirPermiso(usuario, "cartera.view");
  } catch {
    return new Response("No autorizado", { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const edad = sp.get("edad");
  const cubeta = CUBETAS.some((c) => c.clave === edad) ? (edad as CubetaAging) : undefined;
  const q = sp.get("q") ?? undefined;

  const filas = await exportarFacturas(usuario, alcance, { cubeta, q });
  const cuerpo: (string | number)[][] = filas.map((f) => [
    f.numero, f.cliente, f.nit ?? "", f.concepto ?? "",
    formatFecha(f.fechaEmision), formatFecha(f.fechaVencimiento), f.dias, f.estado, f.saldo,
  ]);
  cuerpo.push(["", "", "", "", "", "", "", "TOTAL", filas.reduce((s, f) => s + f.saldo, 0)]);

  return libroDescarga({
    hoja: "Cartera",
    encabezado: ["Factura", "Cliente", "NIT", "Concepto", "Emisión", "Vence", "Días", "Estado", "Saldo"],
    filas: cuerpo,
    anchos: [14, 34, 14, 34, 12, 12, 8, 14, 16],
    archivo: `cartera${cubeta ? `-${cubeta}` : ""}.xlsx`,
  });
}
