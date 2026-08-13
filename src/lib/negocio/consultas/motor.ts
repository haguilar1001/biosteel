// ==========================================================
// Motor de consultas en lenguaje natural (local, sin API externa).
// responder(): normaliza la pregunta, extrae entidades, puntúa cada
// intención y ejecuta la ganadora. Todo el trabajo ocurre en el servidor
// contra las funciones de negocio ya existentes; los datos no salen de la app.
// ==========================================================
import "server-only";
import type { UsuarioConRol } from "@/lib/auth/session";
import type { Alcance } from "@/lib/rbac/permissions";
import {
  normalizar, extraerAnios, extraerMeses, extraerTopN, extraerTopNPalabra,
  extraerMetrica, pideRanking, pideExtremo,
} from "./nlp";
import { INTENTS, type Ctx } from "./intents";
import type { Respuesta } from "./tipos";

export interface OpcionesResponder {
  usuario: UsuarioConRol;
  alcance: Alcance;
  /** Año "actual" (por defecto el del servidor). Inyectable para tests. */
  anioActual?: number;
}

/** Preguntas de ejemplo (para chips de la UI y ayuda). */
export function preguntasEjemplo(): string[] {
  return [
    "Dame el top 5 de clientes del año",
    "¿Cuál es el mes que más se ha vendido en 2026?",
    "¿Cuál es el top de proveedores?",
    "¿Cuánto hemos vendido este año?",
    "Ventas por línea",
    "¿Cómo va el flujo de caja este año?",
    "¿Cuánto cuesta la nómina?",
    "¿Cuál es la utilidad neta del año?",
    "¿Cuánta cartera tenemos por cobrar?",
    "¿Cuánto debemos a proveedores?",
    "Obligaciones financieras",
    "¿Cómo vamos con los indicadores?",
  ];
}

/** Construye el contexto de la pregunta (entidades extraídas). */
function construirCtx(pregunta: string, opts: OpcionesResponder): Ctx {
  const texto = normalizar(pregunta);
  const anioActual = opts.anioActual ?? new Date().getFullYear();
  return {
    texto,
    original: pregunta,
    anios: extraerAnios(texto, anioActual),
    meses: extraerMeses(texto),
    topN: extraerTopN(texto) ?? extraerTopNPalabra(texto),
    metrica: extraerMetrica(texto),
    extremo: pideExtremo(texto),
    ranking: pideRanking(texto),
    anioActual,
    usuario: opts.usuario,
    alcance: opts.alcance,
  };
}

/** Elige la intención de mayor puntaje (>0). Devuelve null si ninguna aplica. */
function elegirIntent(ctx: Ctx) {
  let mejor: { intent: (typeof INTENTS)[number]; score: number } | null = null;
  for (const intent of INTENTS) {
    const score = intent.score(ctx);
    if (score > 0 && (!mejor || score > mejor.score)) mejor = { intent, score };
  }
  return mejor;
}

/** Responde una pregunta en lenguaje natural. Nunca lanza: devuelve Respuesta. */
export async function responder(pregunta: string, opts: OpcionesResponder): Promise<Respuesta> {
  const limpia = (pregunta ?? "").trim();
  if (!limpia) {
    return noEntendida("Escribe una pregunta.");
  }
  const ctx = construirCtx(limpia, opts);
  const elegido = elegirIntent(ctx);
  if (!elegido) return noEntendida();

  try {
    return await elegido.intent.run(ctx);
  } catch (e) {
    console.error("[consultas] error ejecutando intent", elegido.intent.id, e);
    return {
      ok: false,
      titulo: "No pude calcularlo",
      resumen: "Ocurrió un error al consultar los datos. Intenta de nuevo o reformula la pregunta.",
      sugerencias: preguntasEjemplo().slice(0, 4),
    };
  }
}

function noEntendida(resumen?: string): Respuesta {
  return {
    ok: false,
    titulo: "No entendí la pregunta",
    resumen: resumen ?? "Prueba con preguntas sobre ventas, clientes, proveedores, flujo de caja, cartera, nómina o utilidad. Aquí tienes algunas ideas:",
    sugerencias: preguntasEjemplo().slice(0, 6),
  };
}
