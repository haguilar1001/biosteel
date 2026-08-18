// Exporta a Excel la cartera por ciudad (ciudad → IPS, con subtotales). Alcance RBAC.
import type { NextRequest } from "next/server";
import { getUsuarioActual } from "@/lib/auth/current-user";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { carteraPorCiudad } from "@/lib/negocio/cartera";
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
  const { anio, mes } = leerPeriodo({ anio: sp.get("anio") ?? undefined, mes: sp.get("mes") ?? undefined });
  const ciudades = await carteraPorCiudad(usuario, alcance, { anio, mes });
  const cuerpo: (string | number)[][] = [];
  for (const c of ciudades) {
    for (const ips of c.ips) cuerpo.push([c.ciudad, ips.cliente, ips.documentos, ips.saldo]);
    cuerpo.push([`Total ${c.ciudad}`, "", c.documentos, c.saldo]);
  }
  cuerpo.push([
    "TOTAL", "",
    ciudades.reduce((s, c) => s + c.documentos, 0),
    ciudades.reduce((s, c) => s + c.saldo, 0),
  ]);

  return libroDescarga({
    hoja: "Cartera por ciudad",
    encabezado: ["Ciudad", "Cliente (IPS)", "Documentos", "Saldo"],
    filas: cuerpo,
    anchos: [24, 40, 14, 18],
    archivo: "cartera-por-ciudad.xlsx",
  });
}
