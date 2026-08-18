// Exporta a Excel el comparativo Facturado vs Pagado por proveedor.
// mes = "all" → año corrido; numérico → ese mes; vacío → último con pagos.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { facturadoVsPagado } from "@/lib/negocio/cxp";
import { mesesConMovimiento } from "@/lib/negocio/flujo";
import { libroDescarga } from "@/lib/xlsx-export";

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario();
  if (!(await puede(usuario, "cxp.view"))) return new Response("No autorizado", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const anioRaw = sp.get("anio");
  const anio = anioRaw && /^\d{4}$/.test(anioRaw) ? Number(anioRaw) : new Date().getFullYear();
  const mesRaw = sp.get("mes");
  const meses = await mesesConMovimiento(anio, "egreso");
  const ultimo = meses.length ? meses[meses.length - 1]! : new Date().getMonth() + 1;
  const mes = mesRaw === "all" ? undefined : mesRaw && /^\d+$/.test(mesRaw) ? Number(mesRaw) : ultimo;

  const filas = (await facturadoVsPagado(anio, mes)).filter((f) => f.facturado > 0 || f.pagado > 0);
  const cuerpo: (string | number)[][] = filas.map((f) => [
    f.proveedor, f.nit ?? "", f.facturado, f.pagado, f.pagado - f.facturado,
    f.facturado > 0 ? Number(((f.pagado / f.facturado) * 100).toFixed(2)) : "",
  ]);
  const totFact = filas.reduce((s, f) => s + f.facturado, 0);
  const totPag = filas.reduce((s, f) => s + f.pagado, 0);
  cuerpo.push([
    "TOTAL", "", totFact, totPag, totPag - totFact,
    totFact > 0 ? Number(((totPag / totFact) * 100).toFixed(2)) : "",
  ]);

  return libroDescarga({
    hoja: "Facturado vs Pagado",
    encabezado: ["Proveedor", "NIT", "Facturado", "Pagado", "Diferencia", "% Pagado"],
    filas: cuerpo,
    anchos: [40, 14, 18, 18, 18, 12],
    archivo: `facturado-vs-pagado-${anio}${mes ? `-${String(mes).padStart(2, "0")}` : "-anio"}.xlsx`,
  });
}
