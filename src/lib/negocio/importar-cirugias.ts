// ==========================================================
// Parseo + persistencia de CIRUGÍAS con asistencia técnica.
// Fuente: "Consulta Cirugía Diaria" (SIESA) + hoja CiudadCliente (ciudad/grupo).
// - Deduplica por Nro documento.
// - Descarta filas con fecha inválida (años tipográficos como 60/95/1753).
// - No guarda datos del paciente.
// Estrategia: REEMPLAZA toda la tabla. Compartido por el CLI y la carga web.
// ==========================================================
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

export interface CirugiaParseada {
  nroDocumento: string;
  numeroCaso: string | null;
  fecha: Date | null;
  anio: number;
  mes: number;
  dia: number;
  co: string | null;
  convenio: string | null;
  asesor: string;
  sinSoporte: boolean;
  ips: string;
  ciudad: string | null;
  grupo: string | null;
  medico: string | null;
  minutos: number | null;
}
export interface ParseCirugias { hoja: string; filas: CirugiaParseada[]; omitidas: number }

const norm = (s: unknown) => String(s ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, " ").replace(/\s+/g, " ").trim();
/** "CC123-JOSE PEREZ" → "JOSE PEREZ"; deja el texto tal cual si no trae prefijo. */
const nombreLimpio = (s: unknown): string => {
  const t = String(s ?? "").trim();
  const i = t.indexOf("-");
  return (i >= 0 ? t.slice(i + 1) : t).trim();
};

function parseFechaMDY(s: unknown): Date | null {
  if (s instanceof Date) return isNaN(s.getTime()) ? null : new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const p = String(s ?? "").trim().split(/\s+/)[0] ?? "";
  const m = p.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const [, mo, d, y] = m as unknown as [string, string, string, string];
  const yy = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  if (yy < 2020 || yy > 2035) return null; // descarta años tipográficos
  const dt = new Date(yy, Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}
/** "8:00:39 AM" → minutos desde medianoche. */
function horaAMin(s: unknown): number | null {
  const m = String(s ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2]); const ap = (m[4] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

export function parseCirugias(buffer: Buffer): ParseCirugias {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const hoja = "Consulta Cirugía Diaria";
  const ws = wb.Sheets[hoja] ?? wb.Sheets[wb.SheetNames[0]!];
  if (!ws) throw new Error(`No se encontró la hoja "${hoja}".`);

  // Mapa ciudad/grupo por cliente (hoja CiudadCliente).
  const ciudadMap = new Map<string, { ciudad: string; grupo: string }>();
  const wsCC = wb.Sheets["CiudadCliente"];
  if (wsCC) {
    const cc = XLSX.utils.sheet_to_json<unknown[]>(wsCC, { header: 1, defval: null });
    for (let r = 1; r < cc.length; r++) {
      const row = cc[r] as unknown[]; if (!row) continue;
      const k = norm(row[0]); if (!k) continue;
      ciudadMap.set(k, { ciudad: String(row[1] ?? "").trim() || "", grupo: String(row[2] ?? "").trim() || "" });
    }
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false });
  if (!rows.length) throw new Error("La hoja está vacía.");
  const H = (rows[0] as unknown[]).map((c) => String(c ?? "").trim());
  const ix = (n: string) => H.indexOf(n);
  const C = {
    co: ix("C.O."), conv: ix("Convenio"), fcx: ix("Fecha cx"),
    fin: ix("Hora Finalización Cirugía"), ini: ix("Hora Inicio Cirugia"),
    inst: ix("Instrumentador BIO STEEL"), doc: ix("Nro documento"), caso: ix("Numero de Caso"),
    cli: ix("Razón social cliente despacho"), med: ix("Medico Cirujano"),
  };
  if (C.doc < 0 || C.fcx < 0 || C.inst < 0 || C.cli < 0) {
    throw new Error("No parece la Consulta de Cirugía Diaria: faltan columnas (Nro documento / Fecha cx / Instrumentador / Razón social).");
  }

  const vistos = new Set<string>();
  const filas: CirugiaParseada[] = [];
  let omitidas = 0;
  for (let r = 1; r < rows.length; r++) {
    const f = rows[r] as unknown[]; if (!f) continue;
    const doc = String(f[C.doc] ?? "").trim();
    if (!doc || vistos.has(doc)) { omitidas++; continue; }
    const fecha = parseFechaMDY(f[C.fcx]);
    if (!fecha) { omitidas++; continue; }
    vistos.add(doc);

    const instRaw = String(f[C.inst] ?? "").trim();
    const sinSoporte = /SIN SOPORTE/i.test(instRaw);
    const ips = String(f[C.cli] ?? "").trim();
    const cc = ciudadMap.get(norm(ips));
    const ini = C.ini >= 0 ? horaAMin(f[C.ini]) : null;
    const fin = C.fin >= 0 ? horaAMin(f[C.fin]) : null;
    const minutos = ini != null && fin != null && fin > ini && fin - ini < 1440 ? fin - ini : null;

    filas.push({
      nroDocumento: doc,
      numeroCaso: C.caso >= 0 ? String(f[C.caso] ?? "").trim() || null : null,
      fecha, anio: fecha.getFullYear(), mes: fecha.getMonth() + 1, dia: fecha.getDate(),
      co: C.co >= 0 ? String(f[C.co] ?? "").trim() || null : null,
      convenio: C.conv >= 0 ? String(f[C.conv] ?? "").trim() || null : null,
      asesor: sinSoporte ? "SIN SOPORTE" : (nombreLimpio(instRaw) || "(sin asesor)"),
      sinSoporte,
      ips: ips || "(sin IPS)",
      ciudad: cc?.ciudad || null,
      grupo: cc?.grupo || null,
      medico: C.med >= 0 ? nombreLimpio(f[C.med]) || null : null,
      minutos,
    });
  }
  return { hoja, filas, omitidas };
}

export async function persistirCirugias(prisma: PrismaClient, filas: CirugiaParseada[]): Promise<number> {
  await prisma.cirugia.deleteMany({});
  const BATCH = 3000;
  for (let i = 0; i < filas.length; i += BATCH) {
    await prisma.cirugia.createMany({ data: filas.slice(i, i + BATCH) });
  }
  return filas.length;
}
