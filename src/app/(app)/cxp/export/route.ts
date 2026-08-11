// Exporta a Excel el detalle de cuentas por pagar (CxP) según la búsqueda.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { exportarDocumentosCxp } from "@/lib/negocio/cxp";
import { libroDescarga } from "@/lib/xlsx-export";
import { formatFecha } from "@/lib/format";

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "cxp.view"))) return new Response("No autorizado", { status: 403 });

  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const filas = await exportarDocumentosCxp(q);
  const cuerpo: (string | number)[][] = filas.map((d) => [
    d.numero, d.proveedor, d.nit ?? "", d.concepto ?? "",
    formatFecha(d.fechaVencimiento), d.dias, d.estado, d.saldo,
  ]);
  cuerpo.push(["", "", "", "", "", "", "TOTAL", filas.reduce((s, d) => s + d.saldo, 0)]);

  return libroDescarga({
    hoja: "CxP",
    encabezado: ["Documento", "Proveedor", "NIT", "Concepto", "Vence", "Días", "Estado", "Saldo"],
    filas: cuerpo,
    anchos: [14, 34, 14, 34, 12, 8, 14, 16],
    archivo: "cuentas-por-pagar.xlsx",
  });
}
