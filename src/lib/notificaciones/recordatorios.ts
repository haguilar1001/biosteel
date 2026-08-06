// ==========================================================
// Recordatorios de pago de obligaciones financieras.
// Envía correo N días antes (NOTIF_DIAS_ANTES) del próximo pago.
// Idempotente: registra cada envío por (obligación + fecha) para no duplicar.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { listarObligaciones, tipoLabel, type FilaObligacion } from "@/lib/negocio/obligaciones";
import { enviarCorreo, correoConfigurado } from "./mailer";

export function destinatarios(): string[] {
  return env.NOTIF_EMAILS.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface ResultadoRecordatorios {
  configurado: boolean;
  diasAntes: number;
  candidatas: number;
  enviadas: number;
  yaEnviadas: number;
  errores: number;
  detalle: { entidad: string; fecha: string; estado: string }[];
}

function plantilla(o: FilaObligacion, fechaISO: string, dias: number): string {
  const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "full" }).format(new Date(fechaISO + "T00:00:00"));
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #E3E9F1;border-radius:12px;overflow:hidden">
    <div style="background:#2A4F98;color:#fff;padding:16px 20px;font-size:18px;font-weight:700">🦴 BioSteel · Recordatorio de pago</div>
    <div style="padding:20px;color:#1B2434">
      <p>La siguiente obligación financiera vence en <strong>${dias} días</strong>:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#5B6B82">Entidad</td><td style="padding:6px 0;text-align:right;font-weight:700">${o.entidad}</td></tr>
        <tr><td style="padding:6px 0;color:#5B6B82">Tipo / Número</td><td style="padding:6px 0;text-align:right">${tipoLabel(o.tipo)} · ${o.numero}</td></tr>
        <tr><td style="padding:6px 0;color:#5B6B82">Fecha de pago</td><td style="padding:6px 0;text-align:right;font-weight:700">${fecha}</td></tr>
        <tr><td style="padding:6px 0;color:#5B6B82">Cuota</td><td style="padding:6px 0;text-align:right;font-weight:700">${o.cuotaMensual != null ? formatCOP(o.cuotaMensual) : "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#5B6B82">Saldo</td><td style="padding:6px 0;text-align:right">${formatCOP(o.saldoCapital)}</td></tr>
        <tr><td style="padding:6px 0;color:#5B6B82">Tasa EA</td><td style="padding:6px 0;text-align:right">${o.tasaEA != null ? formatPorcentaje(o.tasaEA) : "—"}</td></tr>
      </table>
      <p style="color:#5B6B82;font-size:12px;margin-top:16px">Mensaje automático del sistema de flujo de caja de BioSteel de Colombia S.A.S.</p>
    </div>
  </div>`;
}

export async function ejecutarRecordatorios(hoy: Date = new Date()): Promise<ResultadoRecordatorios> {
  const diasAntes = env.NOTIF_DIAS_ANTES;
  const to = destinatarios();
  const obligaciones = await listarObligaciones(hoy);

  // Ventana: próximo pago dentro de los próximos `diasAntes` días (inclusive).
  const candidatas = obligaciones.filter((o) => o.proximaFecha && o.diasHasta != null && o.diasHasta >= 0 && o.diasHasta <= diasAntes && o.cuotaMensual);

  const res: ResultadoRecordatorios = {
    configurado: correoConfigurado(), diasAntes, candidatas: candidatas.length,
    enviadas: 0, yaEnviadas: 0, errores: 0, detalle: [],
  };

  for (const o of candidatas) {
    const fechaISO = o.proximaFecha!.toISOString().slice(0, 10);
    const clave = `obligacion:${o.numero}:${fechaISO}`;
    const ya = await prisma.notificacionEnviada.findUnique({ where: { clave } });
    if (ya) { res.yaEnviadas++; res.detalle.push({ entidad: o.entidad, fecha: fechaISO, estado: "ya enviada" }); continue; }

    const asunto = `Recordatorio de pago · ${o.entidad} · vence ${fechaISO}`;
    try {
      if (!res.configurado) throw new Error("SMTP no configurado");
      await enviarCorreo(to, asunto, plantilla(o, fechaISO, o.diasHasta!));
      await prisma.notificacionEnviada.create({
        data: { clave, tipo: "obligacion", referencia: o.numero, fechaEvento: o.proximaFecha!, destinatarios: to.join(","), asunto, estado: "enviada" },
      });
      res.enviadas++; res.detalle.push({ entidad: o.entidad, fecha: fechaISO, estado: "enviada" });
    } catch (e) {
      const err = e instanceof Error ? e.message : "error";
      // No se registra en BD para reintentar en la próxima corrida.
      res.errores++; res.detalle.push({ entidad: o.entidad, fecha: fechaISO, estado: `error: ${err}` });
    }
  }
  return res;
}
