// ==========================================================
// Recordatorios de pago de obligaciones financieras.
// Envía correo en tres momentos por vencimiento: N días antes
// (NOTIF_DIAS_ANTES, normalmente 5), 1 día antes y el mismo día.
// Cada aviso se envía una sola vez (idempotente por obligación+fecha+umbral)
// y usa umbrales "≤" para no perder avisos si el cron se salta un día.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { listarObligaciones, tipoLabel, type FilaObligacion } from "@/lib/negocio/obligaciones";
import { obtenerConfig } from "./config";
import { enviarCorreo, correoConfigurado } from "./mailer";

export interface ResultadoRecordatorios {
  configurado: boolean;
  diasAntes: number;
  candidatas: number;
  enviadas: number;
  yaEnviadas: number;
  errores: number;
  detalle: { entidad: string; fecha: string; estado: string }[];
}

type Urgencia = "proximo" | "manana" | "hoy";

function urgenciaDe(dias: number): Urgencia {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "manana";
  return "proximo";
}

interface EstiloAviso {
  header: string;   // color del encabezado
  badgeBg: string;
  badgeFg: string;  // color de la insignia y de los datos acentuados
  titulo: string;   // texto del encabezado
  badge: (dias: number) => string;
  lead: (fechaFull: string, dias: number) => string;
  asunto: (entidad: string, fechaISO: string) => string;
}

const ESTILO: Record<Urgencia, EstiloAviso> = {
  proximo: {
    header: "#2A4F98", badgeBg: "#EAF0FB", badgeFg: "#2A4F98",
    titulo: "🦴 BioSteel · Recordatorio de pago",
    badge: (d) => `Vence en ${d} días`,
    lead: (f, d) => `La siguiente obligación financiera vence el <strong>${f}</strong> (en ${d} días). Te avisamos con anticipación para que la dejes programada.`,
    asunto: (e, f) => `Recordatorio de pago · ${e} · vence ${f}`,
  },
  manana: {
    header: "#C6771A", badgeBg: "#FBEBD5", badgeFg: "#9A5A00",
    titulo: "🦴 BioSteel · Pago mañana",
    badge: () => "Vence mañana",
    lead: (f) => `Recordatorio: esta obligación financiera vence <strong>mañana</strong>, el ${f}. Asegúrate de tener los fondos y la transacción lista.`,
    asunto: (e, f) => `⏰ Pago mañana · ${e} · vence ${f}`,
  },
  hoy: {
    header: "#C0392B", badgeBg: "#FADBD6", badgeFg: "#A5281B",
    titulo: "🦴 BioSteel · Vence hoy",
    badge: () => "Vence hoy",
    lead: (f) => `Atención: esta obligación financiera <strong>vence hoy</strong>, ${f}. Realiza el pago durante el día para evitar intereses de mora.`,
    asunto: (e, f) => `🔴 Vence HOY · ${e} · ${f}`,
  },
};

function fila(label: string, valor: string, opts?: { fuerte?: boolean; color?: string; ultima?: boolean }): string {
  const borde = opts?.ultima ? "" : "border-bottom:1px solid #EEF2F7";
  const peso = opts?.fuerte ? "font-weight:700;" : "";
  const color = opts?.color ? `color:${opts.color};` : "";
  return `<tr><td style="padding:7px 0;color:#5B6B82;${borde}">${label}</td><td style="padding:7px 0;text-align:right;${peso}${color}${borde}">${valor}</td></tr>`;
}

function plantilla(o: FilaObligacion, fechaISO: string, dias: number): string {
  const est = ESTILO[urgenciaDe(dias)];
  const fechaFull = new Intl.DateTimeFormat("es-CO", { dateStyle: "full" }).format(new Date(fechaISO + "T00:00:00"));
  const acentoFecha = urgenciaDe(dias) === "hoy" ? est.badgeFg : undefined;
  const acentoCuota = urgenciaDe(dias) !== "proximo" ? est.badgeFg : undefined;
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;border:1px solid #E3E9F1;border-radius:12px;overflow:hidden;background:#FFFFFF">
    <div style="background:${est.header};color:#ffffff;padding:16px 20px;font-size:18px;font-weight:700">${est.titulo}</div>
    <div style="padding:22px 20px;color:#1B2434">
      <div style="display:inline-block;background:${est.badgeBg};color:${est.badgeFg};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;margin-bottom:12px">${est.badge(dias)}</div>
      <p style="margin:0 0 14px;font-size:15px">${est.lead(fechaFull, dias)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${fila("Entidad", o.entidad, { fuerte: true })}
        ${fila("Tipo / Número", `${tipoLabel(o.tipo)} · ${o.numero}`)}
        ${fila("Fecha de pago", fechaISO, { fuerte: true, color: acentoFecha })}
        ${fila("Cuota", o.cuotaMensual != null ? formatCOP(o.cuotaMensual) : "—", { fuerte: true, color: acentoCuota })}
        ${fila("Saldo", formatCOP(o.saldoCapital))}
        ${fila("Tasa EA", o.tasaEA != null ? formatPorcentaje(o.tasaEA) : "—", { ultima: true })}
      </table>
      <p style="color:#5B6B82;font-size:12px;margin-top:18px;margin-bottom:0">Mensaje automático de la APP Bio Steel · BioSteel de Colombia S.A.S.</p>
    </div>
  </div>`;
}

export async function ejecutarRecordatorios(hoy: Date = new Date()): Promise<ResultadoRecordatorios> {
  const cfg = await obtenerConfig();
  const diasAntes = cfg.diasAntes;
  const to = cfg.destinatarios;
  const obligaciones = await listarObligaciones(hoy);

  // Umbrales de aviso (días antes): el configurable + 1 día antes + el día del
  // vencimiento. Ascendente (más urgente primero al recorrer): p. ej. [0, 1, 5].
  const umbrales = [...new Set([diasAntes, 1, 0])].filter((d) => d >= 0).sort((a, b) => a - b);
  const maxUmbral = umbrales.length ? umbrales[umbrales.length - 1]! : diasAntes;

  // Ventana: próximo pago dentro del mayor umbral (inclusive) y con cuota.
  const candidatas = obligaciones.filter(
    (o) => o.proximaFecha && o.diasHasta != null && o.diasHasta >= 0 && o.diasHasta <= maxUmbral && o.cuotaMensual,
  );

  const res: ResultadoRecordatorios = {
    configurado: correoConfigurado(), diasAntes, candidatas: candidatas.length,
    enviadas: 0, yaEnviadas: 0, errores: 0, detalle: [],
  };

  for (const o of candidatas) {
    const fechaISO = o.proximaFecha!.toISOString().slice(0, 10);

    // Umbral más urgente aplicable (diasHasta ≤ umbral) que aún no se ha enviado.
    // La clave del umbral configurado conserva el formato legacy (sin sufijo)
    // para no reenviar los avisos ya emitidos antes de este cambio.
    let claveElegida: string | null = null;
    for (const t of umbrales) {
      if (o.diasHasta! > t) continue;
      const clave = t === diasAntes
        ? `obligacion:${o.numero}:${fechaISO}`
        : `obligacion:${o.numero}:${fechaISO}:t${t}`;
      const ya = await prisma.notificacionEnviada.findUnique({ where: { clave } });
      if (!ya) { claveElegida = clave; break; }
    }

    if (!claveElegida) { res.yaEnviadas++; res.detalle.push({ entidad: o.entidad, fecha: fechaISO, estado: "ya enviada" }); continue; }

    const est = ESTILO[urgenciaDe(o.diasHasta!)];
    const asunto = est.asunto(o.entidad, fechaISO);
    try {
      if (!res.configurado) throw new Error("SMTP no configurado");
      await enviarCorreo(to, asunto, plantilla(o, fechaISO, o.diasHasta!));
      await prisma.notificacionEnviada.create({
        data: { clave: claveElegida, tipo: "obligacion", referencia: o.numero, fechaEvento: o.proximaFecha!, destinatarios: to.join(","), asunto, estado: "enviada" },
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
