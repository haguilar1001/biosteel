// ==========================================================
// Sincronización diaria del Flujo de Caja desde OneDrive.
// Protegido con CRON_SECRET (header x-cron-secret o ?secret=).
// Cron en Railway (3:00 a.m., 12:00 m. y 5:00 p.m. COT → 0 8,17,22 * * * UTC).
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
  // motivo del fallo sea visible en el navegador/curl. no-store: no cachear.
  return NextResponse.json(res, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export const GET = handler;
export const POST = handler;
