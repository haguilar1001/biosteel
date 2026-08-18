// Exporta a Excel el detalle de cuentas por pagar (CxP) según la búsqueda.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { exportarDocumentosCxp } from "@/lib/negocio/cxp";
import { leerPeriodo } from "@/lib/periodo";
import { libroDescarga } from "@/lib/xlsx-export";
import { formatFecha } from "@/lib/format";

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "cxp.view"))) return new Response("No autorizado", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? undefined;
  const { anio, mes } = leerPeriodo({ anio: sp.get("anio") ?? undefined, mes: sp.get("mes") ?? undefined });
  const filas = await exportarDocumentosCxp(q, new Date(), { anio, mes });
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
    archivo: `cuentas-por-pagar${anio ? `-${anio}` : ""}${mes ? `-${String(mes).padStart(2, "0")}` : ""}.xlsx`,
  });
}
