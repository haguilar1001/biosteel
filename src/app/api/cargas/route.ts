// ==========================================================
// Carga de archivos IN-APP (autenticada). Reemplaza la ruta pública con token.
// Recibe multipart con UN campo = clave del dataset (pendientes, ventas,
// facturacion, gastos, anuladas, pyg, flujo). Exige sesión y el PERMISO del
// dataset (uno por archivo). Procesa y devuelve el ResultadoDataset.
// ==========================================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUsuarioActual } from "@/lib/auth/current-user";
import { puede } from "@/lib/rbac/authorize";
import { CARGAS } from "@/lib/negocio/cargas";
import { esConfirmacionPendiente } from "@/lib/negocio/carga-confirmacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    return NextResponse.json({ ok: false, error: "Sesión no válida. Vuelve a iniciar sesión." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo leer el formulario (¿archivo demasiado grande?)." }, { status: 400 });
  }

  // Toma el primer dataset conocido presente en el formulario.
  const def = CARGAS.find((c) => {
    const f = form.get(c.clave);
    return f && typeof f === "object" && "arrayBuffer" in f && (f as File).size > 0;
  });
  if (!def) {
    return NextResponse.json({ ok: false, error: "No se recibió ningún archivo válido." }, { status: 400 });
  }

  if (!(await puede(usuario, def.permiso))) {
    return NextResponse.json({ ok: false, error: `No tienes permiso para cargar “${def.titulo}”.` }, { status: 403 });
  }

  const file = form.get(def.clave) as File;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  // El "sí" del usuario a un reemplazo que borra datos ya cargados: llega en
  // un segundo envío del mismo archivo. Ver carga-confirmacion.ts.
  const confirmado = form.get("confirmar") === "1";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataset = await def.procesar(buffer, file.name, ip, confirmado);
    // Bitácora unificada de la carga manual (con el usuario que la subió).
    await prisma.cargaSiesa.create({
      data: { ok: true, resumen: { datasets: { [def.clave]: dataset }, usuario: usuario.nombre } as object, origenIp: ip ?? null },
    });
    return NextResponse.json({ ok: true, datasets: { [def.clave]: dataset } }, { status: 200 });
  } catch (e) {
    // Nada se escribió: es una pregunta, no un fallo. No va a la bitácora.
    if (esConfirmacionPendiente(e)) {
      return NextResponse.json(
        { ok: false, confirmar: { clave: def.clave, titulo: def.titulo, mensaje: e.message } },
        { status: 409 },
      );
    }
    const msg = e instanceof Error ? e.message : "error al procesar";
    await prisma.cargaSiesa.create({
      data: { ok: false, resumen: { datasets: {}, usuario: usuario.nombre, dataset: def.titulo, archivo: file.name } as object, mensaje: `${def.titulo} (${file.name}): ${msg}`, origenIp: ip ?? null },
    }).catch(() => {});
    return NextResponse.json({ ok: false, errores: [`${def.titulo} (${file.name}): ${msg}`] }, { status: 207 });
  }
}
