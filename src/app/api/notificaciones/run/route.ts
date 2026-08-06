// ==========================================================
// Endpoint para el cron diario de recordatorios de pago.
// Protegido con CRON_SECRET (header x-cron-secret o ?secret=).
// Configura un cron diario en Railway que haga GET a esta ruta.
// ==========================================================
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ejecutarRecordatorios } from "@/lib/notificaciones/recordatorios";

export const dynamic = "force-dynamic";

async function handler(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? req.headers.get("x-cron-secret");
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const resultado = await ejecutarRecordatorios();
  return NextResponse.json({ ok: true, ...resultado });
}

export const GET = handler;
export const POST = handler;
