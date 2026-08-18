// Exporta a Excel el informe de cartera por cliente (neto).
// Alcance RBAC + búsqueda + periodo de vencimiento (año/mes).
import type { NextRequest } from "next/server";
import { getUsuarioActual } from "@/lib/auth/current-user";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { carteraPorCliente } from "@/lib/negocio/cartera";
import { leerPeriodo } from "@/lib/periodo";
import { libroDescarga } from "@/lib/xlsx-export";

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
  const q = sp.get("q") ?? undefined;
  const { anio, mes } = leerPeriodo({ anio: sp.get("anio") ?? undefined, mes: sp.get("mes") ?? undefined });

  const filas = await carteraPorCliente(usuario, alcance, q, new Date(), { anio, mes });
  const cuerpo: (string | number)[][] = filas.map((f) => [
    f.cliente, f.nit ?? "", f.documentos, f.saldoNeto, f.vencido, f.diasMax,
  ]);
  cuerpo.push([
    "TOTAL", "",
    filas.reduce((s, f) => s + f.documentos, 0),
    filas.reduce((s, f) => s + f.saldoNeto, 0),
    filas.reduce((s, f) => s + f.vencido, 0),
    "",
  ]);

  return libroDescarga({
    hoja: "Cartera por cliente",
    encabezado: ["Cliente", "NIT", "Facturas", "Saldo neto", "Vencido", "Mora máx (días)"],
    filas: cuerpo,
    anchos: [40, 14, 10, 18, 18, 16],
    archivo: `cartera-por-cliente${anio ? `-${anio}` : ""}${mes ? `-${String(mes).padStart(2, "0")}` : ""}.xlsx`,
  });
}
