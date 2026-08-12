// Exporta a Excel el informe de CxP por proveedor (neto). Búsqueda + tipo.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { cxpPorProveedor, type TipoProveedorFiltro } from "@/lib/negocio/cxp";
import { libroDescarga } from "@/lib/xlsx-export";

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "cxp.view"))) return new Response("No autorizado", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? undefined;
  const tipoRaw = sp.get("tipo");
  const tipo: TipoProveedorFiltro | undefined = tipoRaw === "interno" || tipoRaw === "externo" ? tipoRaw : undefined;

  const filas = await cxpPorProveedor(q, tipo);
  const cuerpo: (string | number)[][] = filas.map((f) => [
    f.proveedor, f.nit ?? "", f.interno ? "Interno" : "Externo", f.documentos, f.saldoNeto, f.vencido, f.diasMax,
  ]);
  cuerpo.push([
    "TOTAL", "", "",
    filas.reduce((s, f) => s + f.documentos, 0),
    filas.reduce((s, f) => s + f.saldoNeto, 0),
    filas.reduce((s, f) => s + f.vencido, 0),
    "",
  ]);

  return libroDescarga({
    hoja: "CxP por proveedor",
    encabezado: ["Proveedor", "NIT", "Tipo", "Docs", "Saldo neto", "Vencido", "Mora máx (días)"],
    filas: cuerpo,
    anchos: [40, 14, 10, 8, 18, 18, 16],
    archivo: `cxp-por-proveedor${tipo ? `-${tipo}` : ""}.xlsx`,
  });
}
