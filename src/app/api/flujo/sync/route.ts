// ==========================================================
// Sincronización diaria del Flujo de Caja desde OneDrive.
// Protegido con CRON_SECRET (header x-cron-secret o ?secret=).
// Configura un cron diario (3 am) en Railway que haga GET a esta ruta.
// ==========================================================
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sincronizarFlujo } from "@/lib/negocio/sync-flujo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? req.headers.get("x-cron-secret");
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const res = await sincronizarFlujo(ip);
  // Siempre 200 con el JSON (el campo `ok` indica el resultado) para que el
  // motivo del fallo sea visible en el navegador/curl.
  return NextResponse.json(res, { status: 200 });
}

export const GET = handler;
export const POST = handler;
