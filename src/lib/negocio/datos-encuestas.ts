// ==========================================================
// Arma el objeto DATA del informe de Encuestas de Satisfacción a partir de la
// base (mismo shape que consume la plantilla HTML). Se filtra por año; por
// defecto el último año con encuestas institucionales.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { PREGUNTAS_INST, COMPONENTES, CRITERIOS_ORTHO, nivelSatisfaccion } from "@/lib/encuestas/catalogo";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const p2 = (n: number) => String(n).padStart(2, "0");
const fechaDMY = (d: Date | null) => (d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}` : "—");

export interface DatosEncuestas {
  anio: number | null;
  anios: number[];
  vacio: boolean;
  data: unknown; // objeto DATA para la plantilla
}

export async function datosEncuestas(anioSel?: number): Promise<DatosEncuestas> {
  const encuestas = await prisma.encuestaSatisfaccion.findMany({ include: { respuestas: true }, orderBy: { id: "asc" } });
  const anios = [...new Set(encuestas.map((e) => e.anio))].sort((a, b) => b - a);
  const instAnios = [...new Set(encuestas.filter((e) => e.tipo === "institucional").map((e) => e.anio))].sort((a, b) => b - a);
  const anio = anioSel && anios.includes(anioSel) ? anioSel : (instAnios[0] ?? anios[0] ?? null);

  if (anio == null) {
    return { anio: null, anios, vacio: true, data: null };
  }

  const inst = encuestas.filter((e) => e.tipo === "institucional" && e.anio === anio);
  const orth = encuestas.filter((e) => e.tipo === "ortopedista" && e.anio === anio);

  // ---- Institucional: registros ----
  const records = inst.map((e, idx) => {
    const map = new Map(e.respuestas.map((r) => [r.codigo, r.valor]));
    const items = PREGUNTAS_INST.map((q) => map.get(q.codigo) ?? null);
    const vals = items.filter((v): v is number => v != null);
    const promedio = avg(vals);
    return {
      encuesta: Number(e.origenId) || idx + 1,
      fecha: fechaDMY(e.fecha),
      cliente: e.cliente,
      cargo: e.cargo ?? "No especificado",
      items,
      promedio,
      pct: promedio / 5,
    };
  });

  // ---- Institucional: por pregunta ----
  const valoresPorCodigo = new Map<string, number[]>();
  for (const e of inst) for (const r of e.respuestas) {
    if (!valoresPorCodigo.has(r.codigo)) valoresPorCodigo.set(r.codigo, []);
    valoresPorCodigo.get(r.codigo)!.push(r.valor);
  }
  const questions = PREGUNTAS_INST.map((q) => {
    const promedio = avg(valoresPorCodigo.get(q.codigo) ?? []);
    return { codigo: q.codigo, pregunta: q.pregunta, promedio, pct: promedio / 5, nivel: nivelSatisfaccion(promedio) };
  });

  // ---- Institucional: por componente ----
  const components = COMPONENTES.map((c) => {
    const codes = PREGUNTAS_INST.filter((q) => q.comp === c.clave).map((q) => q.codigo);
    const vals = codes.flatMap((code) => valoresPorCodigo.get(code) ?? []);
    const promedio = avg(vals);
    return { nombre: c.nombre, promedio, pct: promedio / 5, nivel: nivelSatisfaccion(promedio) };
  });

  // ---- Institucional: general + distribución ----
  const todos = inst.flatMap((e) => e.respuestas.map((r) => r.valor));
  const promedioGen = avg(todos);
  const dist: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
  for (const v of todos) dist[String(v)] = (dist[String(v)] ?? 0) + 1;
  const overall = {
    promedio: promedioGen, pct: promedioGen / 5, nivel: nivelSatisfaccion(promedioGen),
    total_encuestas: inst.length, total_respuestas: todos.length, dist,
  };

  // ---- Ortopedistas ----
  const orthoValsPorCodigo = new Map<string, number[]>();
  for (const e of orth) for (const r of e.respuestas) {
    if (!orthoValsPorCodigo.has(r.codigo)) orthoValsPorCodigo.set(r.codigo, []);
    orthoValsPorCodigo.get(r.codigo)!.push(r.valor);
  }
  const orthoItems = CRITERIOS_ORTHO.map((c) => ({ label: c.label, short: c.short, val: avg(orthoValsPorCodigo.get(c.codigo) ?? []) }));
  const orthoTodos = orth.flatMap((e) => e.respuestas.map((r) => r.valor));
  const conRecom = orth.filter((e) => e.recomienda != null);
  const ortho = {
    items: orthoItems,
    promedio: avg(orthoTodos),
    n: orth.length,
    recomendaria_pct: conRecom.length ? conRecom.filter((e) => e.recomienda).length / conRecom.length : 0,
    ciudades: [...new Set(orth.map((e) => e.ciudad).filter(Boolean))],
  };

  return {
    anio, anios, vacio: inst.length === 0 && orth.length === 0,
    data: { records, questions, components, overall, ortho },
  };
}
