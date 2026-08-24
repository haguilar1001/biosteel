// ==========================================================
// Parseo + persistencia de las ENCUESTAS DE SATISFACCIÓN.
//   · Institucional: hoja "Respuestas detalladas" (matriz 19 preguntas).
//   · Ortopedistas: export de Microsoft Forms (tripletes respuesta/puntos/coment.).
// Estrategia: REEMPLAZA todas las encuestas del tipo cargado (reenviar el
// archivo completo no duplica). Compartido por el CLI y la carga web.
// ==========================================================
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";
import { CRITERIOS_ORTHO } from "../encuestas/catalogo";

export type TipoEncuesta = "institucional" | "ortopedista";

export interface EncuestaParseada {
  origenId: string | null;
  fecha: Date | null;
  anio: number;
  cliente: string;
  cargo: string | null;
  ciudad: string | null;
  recomienda: boolean | null;
  respuestas: { codigo: string; valor: number }[];
}
export interface ParseEncuestas { hoja: string; filas: EncuestaParseada[]; omitidas: number }

const normL = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const entero = (v: unknown): number | null => {
  const n = Math.round(Number(String(v ?? "").replace(/[^\d.-]/g, "")));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
};

/** "19/05/2026" → Date. */
function parseDMY(s: unknown): Date | null {
  if (s instanceof Date) return isNaN(s.getTime()) ? null : new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const m = String(s ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const [, d, mo, y] = m as unknown as [string, string, string, string];
  const yy = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  const dt = new Date(yy, Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}
/** "5/14/26 17:46:01" → Date (M/D/YY con hora opcional). */
function parseMDY(s: unknown): Date | null {
  if (s instanceof Date) return isNaN(s.getTime()) ? null : new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const parte = String(s ?? "").trim().split(/\s+/)[0] ?? "";
  const m = parte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const [, mo, d, y] = m as unknown as [string, string, string, string];
  const yy = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  const dt = new Date(yy, Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}

// ---------- Institucional ----------
export function parseInstitucional(buffer: Buffer): ParseEncuestas {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets["Respuestas detalladas"] ?? wb.Sheets[wb.SheetNames[0]!];
  const hoja = ws === wb.Sheets["Respuestas detalladas"] ? "Respuestas detalladas" : (wb.SheetNames[0] ?? "");
  if (!ws) throw new Error('No se encontró la hoja "Respuestas detalladas".');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false });
  if (!rows.length) throw new Error("La hoja está vacía.");

  const H = (rows[0] as unknown[]).map((c) => String(c ?? "").trim());
  const hIdx = (pred: (l: string) => boolean) => H.findIndex((h) => pred(normL(h)));
  const iEnc = hIdx((l) => l === "encuesta");
  const iFecha = hIdx((l) => l === "fecha");
  const iCli = hIdx((l) => l.startsWith("cliente"));
  const iCargo = hIdx((l) => l === "cargo");
  // Columnas de código de pregunta: encabezado exactamente "1.1".."4.4".
  const codigoCols = H.map((h, i) => ({ i, c: h.trim() })).filter((x) => /^[1-4]\.\d$/.test(x.c));
  if (iCli < 0 || codigoCols.length < 10) throw new Error("El archivo no tiene el formato institucional esperado (Cliente + preguntas 1.1..4.4).");

  const filas: EncuestaParseada[] = [];
  let omitidas = 0;
  for (let r = 1; r < rows.length; r++) {
    const fila = rows[r] as unknown[];
    if (!fila) continue;
    const cliente = String(fila[iCli] ?? "").trim();
    if (!cliente) { omitidas++; continue; }
    const respuestas = codigoCols
      .map(({ i, c }) => ({ codigo: c, valor: entero(fila[i]) }))
      .filter((x): x is { codigo: string; valor: number } => x.valor != null);
    if (!respuestas.length) { omitidas++; continue; }
    const fecha = iFecha >= 0 ? parseDMY(fila[iFecha]) : null;
    filas.push({
      origenId: iEnc >= 0 ? String(fila[iEnc] ?? "").trim() || null : null,
      fecha, anio: fecha ? fecha.getFullYear() : new Date().getFullYear(),
      cliente, cargo: iCargo >= 0 ? String(fila[iCargo] ?? "").trim() || null : null,
      ciudad: null, recomienda: null, respuestas,
    });
  }
  return { hoja, filas, omitidas };
}

// ---------- Ortopedistas (Microsoft Forms) ----------
export function parseOrtopedistas(buffer: Buffer): ParseEncuestas {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const hoja = wb.SheetNames[0] ?? "";
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false });
  if (!rows.length) throw new Error("La hoja está vacía.");

  const H = (rows[0] as unknown[]).map((c) => String(c ?? "").trim());
  const L = H.map(normL);
  const esPrefijo = (l: string) => l.startsWith("puntos:") || l.startsWith("comentarios:");

  const iId = L.findIndex((l) => l === "id");
  const iInicio = L.findIndex((l) => l.startsWith("hora de inicio"));
  const iNombre = L.findIndex((l) => l.startsWith("nombre y apellido"));
  const iCiudad = L.findIndex((l) => l === "ciudad");
  const iRecom = L.findIndex((l) => !esPrefijo(l) && l.includes("recomendar"));
  if (iCiudad < 0 || iRecom < 0) throw new Error("El archivo no tiene el formato de ortopedistas esperado (Ciudad + ¿Recomendaría?).");

  // Columnas de respuesta (no prefijadas) entre Ciudad y ¿Recomendaría?: los 14 criterios en orden.
  const criterioCols: number[] = [];
  for (let i = iCiudad + 1; i < iRecom; i++) {
    if (L[i] && !esPrefijo(L[i]!)) criterioCols.push(i);
  }

  const filas: EncuestaParseada[] = [];
  let omitidas = 0;
  for (let r = 1; r < rows.length; r++) {
    const fila = rows[r] as unknown[];
    if (!fila) continue;
    const respuestas = criterioCols
      .map((col, k) => ({ codigo: CRITERIOS_ORTHO[k]?.codigo ?? `O${k + 1}`, valor: entero(fila[col]) }))
      .filter((x): x is { codigo: string; valor: number } => x.valor != null);
    if (!respuestas.length) { omitidas++; continue; }
    const fecha = iInicio >= 0 ? parseMDY(fila[iInicio]) : null;
    const rec = normL(fila[iRecom]);
    filas.push({
      origenId: iId >= 0 ? String(fila[iId] ?? "").trim() || null : null,
      fecha, anio: fecha ? fecha.getFullYear() : new Date().getFullYear(),
      cliente: (iNombre >= 0 ? String(fila[iNombre] ?? "").trim() : "") || "(anónimo)",
      cargo: null,
      ciudad: iCiudad >= 0 ? String(fila[iCiudad] ?? "").trim() || null : null,
      recomienda: rec ? rec.startsWith("s") : null, // "SI"/"Sí" → true, "NO" → false
      respuestas,
    });
  }
  return { hoja, filas, omitidas };
}

// ---------- Persistencia ----------
/** Reemplaza todas las encuestas del tipo indicado. Devuelve cuántas se cargaron. */
export async function persistirEncuestas(prisma: PrismaClient, tipo: TipoEncuesta, filas: EncuestaParseada[]): Promise<number> {
  await prisma.$transaction(async (tx) => {
    await tx.encuestaSatisfaccion.deleteMany({ where: { tipo } });
    for (const f of filas) {
      await tx.encuestaSatisfaccion.create({
        data: {
          tipo, origenId: f.origenId, fecha: f.fecha, anio: f.anio,
          cliente: f.cliente, cargo: f.cargo, ciudad: f.ciudad, recomienda: f.recomienda,
          respuestas: { create: f.respuestas.map((rp) => ({ codigo: rp.codigo, valor: rp.valor })) },
        },
      });
    }
  }, { timeout: 30000 });
  return filas.length;
}
