// Exporta a Excel el listado de movimientos de flujo (ingresos/egresos)
// respetando los filtros de la URL (mes, grupo, búsqueda).
import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { exportarMovimientos } from "@/lib/negocio/flujo";
import { formatFecha } from "@/lib/format";
import type { TipoMovimiento } from "@prisma/client";

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "cxp.view"))) return new Response("No autorizado", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const tipo: TipoMovimiento = sp.get("tipo") === "egreso" ? "egreso" : "ingreso";
  const anio = Number(sp.get("anio")) || new Date().getFullYear();
  const mesRaw = sp.get("mes");
  const mes = mesRaw && /^\d+$/.test(mesRaw) ? Number(mesRaw) : undefined;
  const grupoRaw = sp.get("grupo");
  const categoriaId = grupoRaw && /^\d+$/.test(grupoRaw) ? Number(grupoRaw) : undefined;
  const q = sp.get("q") ?? undefined;

  const filas = await exportarMovimientos(tipo, { anio, mes, categoriaId, q });

  const encabezado = ["Fecha", "Categoría", "Tercero", "NIT", "Detalle", "Observación", "Valor"];
  const cuerpo: (string | number)[][] = filas.map((m) => [
    formatFecha(m.fecha), m.categoria ?? "", m.terceroNombre, m.nit ?? "", m.detalle ?? "", m.observacion ?? "", m.valor,
  ]);
  const total = filas.reduce((s, m) => s + m.valor, 0);
  cuerpo.push(["", "", "", "", "", "TOTAL", total]);

  const ws = XLSX.utils.aoa_to_sheet([encabezado, ...cuerpo]);
  ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 34 }, { wch: 14 }, { wch: 40 }, { wch: 30 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tipo === "ingreso" ? "Ingresos" : "Egresos");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const nombre = `flujo-${tipo === "ingreso" ? "ingresos" : "egresos"}-${anio}${mes ? `-${String(mes).padStart(2, "0")}` : ""}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
