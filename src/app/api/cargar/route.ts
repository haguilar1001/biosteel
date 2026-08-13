// ==========================================================
// Carga de archivos de S1ESA (módulo PENDIENTES).
// Ruta PÚBLICA protegida por token (?token= o header x-carga-token) — la
// auxiliar la usa desde el formulario /cargar sin entrar al sistema.
// Recibe multipart con los campos: facturacion, gastos, anuladas, pendientes.
// ==========================================================
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { procesarCarga, DATASETS, type ArchivoEntrada } from "@/lib/negocio/carga-siesa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-carga-token");
  if (!env.CARGA_TOKEN) {
    return NextResponse.json({ ok: false, error: "El servidor no tiene CARGA_TOKEN configurado (revisa las variables del servicio en Railway)." }, { status: 401 });
  }
  if (token !== env.CARGA_TOKEN) {
    return NextResponse.json({ ok: false, error: "Token inválido: el token del enlace no coincide con el del servidor." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo leer el formulario (¿archivo demasiado grande?)." }, { status: 400 });
  }

  const archivos: ArchivoEntrada[] = [];
  for (const { clave } of DATASETS) {
    const f = form.get(clave);
    if (f && typeof f === "object" && "arrayBuffer" in f && (f as File).size > 0) {
      const file = f as File;
      archivos.push({ clave, nombre: file.name, buffer: Buffer.from(await file.arrayBuffer()) });
    }
  }

  if (archivos.length === 0) {
    return NextResponse.json({ ok: false, error: "No se recibió ningún archivo." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const res = await procesarCarga(archivos, ip);
  return NextResponse.json(res, { status: res.ok ? 200 : 207 });
}
