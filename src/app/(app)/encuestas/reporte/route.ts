// ==========================================================
// Sirve el informe de Encuestas de Satisfacción como HTML, inyectando en la
// plantilla el objeto DATA calculado desde la base. Protegido por sesión +
// permiso (se carga dentro de un iframe desde /encuestas).
// ==========================================================
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requirePermiso } from "@/server/auth-context";
import { datosEncuestas } from "@/lib/negocio/datos-encuestas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requirePermiso("cxp.view");

  const anioParam = new URL(req.url).searchParams.get("anio");
  const { data, vacio } = await datosEncuestas(anioParam ? Number(anioParam) : undefined);

  const plantilla = await readFile(path.join(process.cwd(), "public", "informes", "encuestas-plantilla.html"), "utf8");

  if (vacio || !data) {
    const aviso = `<div style="font-family:Segoe UI,system-ui,sans-serif;padding:40px;text-align:center;color:#5a6b7e">
      <h2 style="color:#1F4E79">Sin encuestas cargadas todavía</h2>
      <p>Sube los archivos en <b>Cargar archivos → Calidad</b> para ver el informe.</p></div>`;
    return new Response(`<!doctype html><meta charset="utf-8">${aviso}`, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // Evita romper el <script> si algún texto trae "<" (nombres de cliente, etc.).
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const html = plantilla.replace("__ENCUESTAS_DATA__", json);

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
