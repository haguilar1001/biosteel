// Exporta a Excel los anticipos / saldos a favor por tercero. Búsqueda + tipo.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { anticiposPorTercero, type TipoProveedorFiltro } from "@/lib/negocio/cxp";
import { libroDescarga } from "@/lib/xlsx-export";

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "cxp.view"))) return new Response("No autorizado", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? undefined;
  const tipoRaw = sp.get("tipo");
  const tipo: TipoProveedorFiltro | undefined = tipoRaw === "interno" || tipoRaw === "externo" ? tipoRaw : undefined;

  const filas = await anticiposPorTercero(q, tipo);
  const cuerpo: (string | number)[][] = filas.map((f) => [
    f.tercero, f.nit ?? "", f.interno ? "Interno" : "Externo", f.documentos, f.anticipo,
  ]);
  cuerpo.push([
    "TOTAL", "", "",
    filas.reduce((s, f) => s + f.documentos, 0),
    filas.reduce((s, f) => s + f.anticipo, 0),
  ]);

  return libroDescarga({
    hoja: "Anticipos",
    encabezado: ["Tercero", "NIT", "Tipo", "Docs", "Anticipo"],
    filas: cuerpo,
    anchos: [40, 14, 10, 8, 18],
    archivo: `anticipos${tipo ? `-${tipo}` : ""}.xlsx`,
  });
}
