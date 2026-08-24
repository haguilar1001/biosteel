// ==========================================================
// Sincroniza el Flujo de Caja (MovimientoFlujo) desde el archivo "Flujo de Caja
// Diario" alojado en OneDrive. Mapea GRUPOS → CategoriaFlujo (crea las que
// falten), reemplaza los movimientos de los AÑOS presentes en el archivo
// (idempotente; el archivo no trae comprobante) y deja bitácora en CargaSiesa.
// Lo dispara el cron diario vía /api/flujo/sync.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { parseFlujoDiario, type MovFlujo } from "./importar-flujo-diario";

const BATCH = 2000;
const r2 = (v: number) => Math.round(v * 100) / 100;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export interface ResultadoFlujoSync {
  ok: boolean;
  hoja?: string;
  movimientos: number;
  omitidas: number;
  anios: number[];
  ingresos: number;
  egresos: number;
  categoriasCreadas: string[];
  error?: string;
}

/** Convierte un enlace de compartir de OneDrive a URL de descarga directa. */
export function urlDescargaDirecta(url: string): string {
  if (/1drv\.ms|onedrive\.live\.com|sharepoint\.com/i.test(url)) {
    const b64 = Buffer.from(url).toString("base64").replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
    return `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content`;
  }
  return url;
}

/** Agrega ?download=1 al enlace (algunos OneDrive/SharePoint lo requieren). */
function conDownload(url: string): string {
  try { const u = new URL(url); u.searchParams.set("download", "1"); return u.toString(); } catch { return url; }
}

/** Enlace de descarga directa de SharePoint: /:x:/g/personal/user/TOKEN → download.aspx?share=TOKEN */
function sharepointDownload(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/sharepoint\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/:[a-z]:\/[a-z]\/(personal\/[^/]+)\/([^/]+)/i);
    if (!m) return null;
    return `${u.origin}/${m[1]}/_layouts/15/download.aspx?share=${m[2]}`;
  } catch { return null; }
}

/** Sigue redirecciones (incl. 308) manualmente CONSERVANDO cookies — necesario
 *  para los enlaces anónimos de SharePoint, que fijan una cookie de invitado. */
async function fetchSiguiendo(url: string, maxHops = 12): Promise<Response> {
  let u = url;
  const jar = new Map<string, string>();
  for (let i = 0; i < maxHops; i++) {
    const headers: Record<string, string> = { "user-agent": "Mozilla/5.0", accept: "*/*" };
    if (jar.size) headers.cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const r = await fetch(u, { redirect: "manual", headers });
    const setCookies: string[] = typeof (r.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (r.headers as { getSetCookie: () => string[] }).getSetCookie()
      : (r.headers.get("set-cookie") ? [r.headers.get("set-cookie") as string] : []);
    for (const c of setCookies) {
      const kv = c.split(";")[0] ?? "";
      const eq = kv.indexOf("=");
      if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
    }
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (!loc) return r;
      u = new URL(loc, u).toString();
      continue;
    }
    return r;
  }
  throw new Error("demasiadas redirecciones");
}

async function descargarOneDrive(url: string): Promise<Buffer> {
  const candidatos = [sharepointDownload(url), conDownload(url), urlDescargaDirecta(url), url].filter((u): u is string => !!u);
  const vistos = new Set<string>();
  let ultimo = "sin respuesta";
  for (const c of candidatos) {
    if (vistos.has(c)) continue;
    vistos.add(c);
    try {
      const r = await fetchSiguiendo(c);
      if (!r.ok) { ultimo = `HTTP ${r.status}`; continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) return buf; // "PK" = .xlsx (zip)
      ultimo = "la respuesta no es un .xlsx (¿el enlace apunta a una página, no al archivo?)";
    } catch (e) { ultimo = e instanceof Error ? e.message : "error"; }
  }
  throw new Error(`No se pudo descargar el archivo de OneDrive: ${ultimo}.`);
}

/** Resuelve GRUPOS → categoriaId, creando las categorías (egreso) que falten. */
async function resolverCategorias(movs: MovFlujo[]): Promise<{ mapa: Map<string, number>; creadas: string[] }> {
  const cats = await prisma.categoriaFlujo.findMany();
  const mapa = new Map<string, number>();
  for (const c of cats) mapa.set(norm(c.nombre), c.id);
  const creadas: string[] = [];
  let orden = cats.reduce((m, c) => Math.max(m, c.orden), 0);
  // Grupos de EGRESO que aún no existen como categoría.
  const faltan = new Set<string>();
  for (const m of movs) if (m.grupo && m.tipo === "egreso" && !mapa.has(norm(m.grupo))) faltan.add(m.grupo);
  for (const nombre of faltan) {
    const c = await prisma.categoriaFlujo.create({ data: { nombre, tipo: "egreso", orden: ++orden } });
    mapa.set(norm(nombre), c.id);
    creadas.push(nombre);
  }
  return { mapa, creadas };
}

/** Persiste los movimientos: reemplaza los años presentes en el archivo. */
async function persistir(movs: MovFlujo[], mapa: Map<string, number>): Promise<void> {
  const anios = [...new Set(movs.map((m) => m.anio))];
  await prisma.movimientoFlujo.deleteMany({ where: { anio: { in: anios } } });
  const filas = movs.map((m) => ({
    documento: null, fecha: m.fecha, anio: m.anio, mes: m.mes, tipo: m.tipo,
    categoriaId: m.grupo ? mapa.get(norm(m.grupo)) ?? null : null,
    terceroNombre: m.terceroNombre, nit: m.nit, beneficiario: m.beneficiario,
    detalle: m.detalle, observacion: m.observacion, valor: r2(m.valor), saldo: m.saldo != null ? r2(m.saldo) : null,
  }));
  for (let i = 0; i < filas.length; i += BATCH) await prisma.movimientoFlujo.createMany({ data: filas.slice(i, i + BATCH) as never });
}

// ---------- Descarga autenticada vía Microsoft Graph (recomendado) ----------

const graphConfigurado = () =>
  Boolean(env.FLUJO_GRAPH_TENANT_ID && env.FLUJO_GRAPH_CLIENT_ID && env.FLUJO_GRAPH_CLIENT_SECRET);

async function tokenGraph(): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.FLUJO_GRAPH_CLIENT_ID!, client_secret: env.FLUJO_GRAPH_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${env.FLUJO_GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body,
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!r.ok || !j.access_token) throw new Error(`Token Graph: HTTP ${r.status} ${(j.error_description ?? "").slice(0, 180)}`);
  return j.access_token;
}

async function descargarGraph(shareUrl: string): Promise<Buffer> {
  const token = await tokenGraph();
  const enc = "u!" + Buffer.from(shareUrl).toString("base64").replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
  const r = await fetch(`https://graph.microsoft.com/v1.0/shares/${enc}/driveItem/content`, {
    headers: { authorization: `Bearer ${token}` }, redirect: "follow",
  });
  if (!r.ok) throw new Error(`Graph descarga: HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 180)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!(buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b)) throw new Error("Graph no devolvió un .xlsx válido.");
  return buf;
}

/**
 * Sincroniza desde un buffer .xlsx ya descargado (útil para probar).
 * `registrar` = escribir la bitácora en CargaSiesa (true por defecto: lo usa el
 * cron). La carga in-app pasa false y registra aparte con el usuario.
 */
export async function sincronizarFlujoDesdeBuffer(buffer: Buffer, origenIp?: string, registrar = true): Promise<ResultadoFlujoSync> {
  const res: ResultadoFlujoSync = { ok: true, movimientos: 0, omitidas: 0, anios: [], ingresos: 0, egresos: 0, categoriasCreadas: [] };
  try {
    const { hoja, movimientos, omitidas } = parseFlujoDiario(buffer);
    if (movimientos.length === 0) throw new Error("El archivo no trae movimientos válidos.");
    const { mapa, creadas } = await resolverCategorias(movimientos);
    await persistir(movimientos, mapa);
    res.hoja = hoja;
    res.movimientos = movimientos.length;
    res.omitidas = omitidas;
    res.anios = [...new Set(movimientos.map((m) => m.anio))].sort((a, b) => a - b);
    res.ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.valor, 0);
    res.egresos = movimientos.filter((m) => m.tipo === "egreso").reduce((s, m) => s + m.valor, 0);
    res.categoriasCreadas = creadas;
  } catch (e) {
    res.ok = false;
    res.error = e instanceof Error ? e.message : "error";
  }
  if (registrar) {
    await prisma.cargaSiesa.create({
      data: { ok: res.ok, resumen: { flujo: res } as unknown as object, mensaje: res.error ?? null, origenIp: origenIp ?? null },
    });
  }
  return res;
}

/** Descarga el archivo desde OneDrive (env.FLUJO_ONEDRIVE_URL) y sincroniza. */
export async function sincronizarFlujo(origenIp?: string): Promise<ResultadoFlujoSync> {
  if (!env.FLUJO_ONEDRIVE_URL) {
    return { ok: false, movimientos: 0, omitidas: 0, anios: [], ingresos: 0, egresos: 0, categoriasCreadas: [], error: "Falta FLUJO_ONEDRIVE_URL en el servidor." };
  }
  let buffer: Buffer;
  try {
    // Con credenciales de Graph → descarga autenticada (confiable). Si no, se
    // intenta la descarga anónima (solo funciona con enlaces públicos).
    buffer = graphConfigurado()
      ? await descargarGraph(env.FLUJO_ONEDRIVE_URL)
      : await descargarOneDrive(env.FLUJO_ONEDRIVE_URL);
  } catch (e) {
    const error = e instanceof Error ? e.message : "error al descargar";
    await prisma.cargaSiesa.create({ data: { ok: false, resumen: { flujo: { error } } as unknown as object, mensaje: error, origenIp: origenIp ?? null } });
    return { ok: false, movimientos: 0, omitidas: 0, anios: [], ingresos: 0, egresos: 0, categoriasCreadas: [], error };
  }
  return sincronizarFlujoDesdeBuffer(buffer, origenIp);
}
