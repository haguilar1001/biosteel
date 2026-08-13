// ==========================================================
// Extracción de entidades de una pregunta en español (motor local, sin API).
// Normaliza el texto (sin tildes, minúsculas) y saca: años, meses, "top N",
// métrica (venta/utilidad/costo/margen) y otras señales. No decide la
// intención — eso lo hace intents.ts con estas señales + palabras clave.
// ==========================================================

/** Minúsculas, sin tildes, espacios colapsados. */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita diacríticos
    .replace(/[^\w\s%$.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿El texto (ya normalizado) contiene alguna de estas palabras/expresiones? */
export function tieneAlguna(texto: string, palabras: string[]): boolean {
  return palabras.some((p) => texto.includes(p));
}

export const MESES_NOMBRE = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Sinónimos/abreviaturas → número de mes.
const MES_ALIAS: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

/** Meses mencionados (por nombre o abreviatura), sin repetir, en orden. */
export function extraerMeses(texto: string): number[] {
  const encontrados = new Set<number>();
  const tokens = texto.split(/[\s,.]+/);
  for (const t of tokens) {
    const m = MES_ALIAS[t];
    if (m) encontrados.add(m);
  }
  return [...encontrados].sort((a, b) => a - b);
}

/**
 * Años mencionados. Reconoce 20xx explícitos y expresiones relativas
 * ("este año", "año pasado", "año anterior", "antepasado").
 */
export function extraerAnios(texto: string, anioActual: number): number[] {
  const anios = new Set<number>();
  for (const m of texto.matchAll(/\b(20\d{2})\b/g)) anios.add(Number(m[1]));

  // También años de dos dígitos precedidos de "del/en el" (del 24, del 25)…
  for (const m of texto.matchAll(/\b(?:del?|en el|año)\s+(2[0-9])\b/g)) {
    anios.add(2000 + Number(m[1]));
  }

  if (/\b(este ano|ano actual|ano corrido|este year|presente ano)\b/.test(texto)) anios.add(anioActual);
  if (/\b(ano pasado|ano anterior|el pasado ano)\b/.test(texto)) anios.add(anioActual - 1);
  if (/\b(antepasado|hace dos anos)\b/.test(texto)) anios.add(anioActual - 2);

  return [...anios].sort((a, b) => a - b);
}

/**
 * "Top N" pedido explícitamente. Reconoce: "top 5", "top5", "los 3",
 * "5 mayores", "primeros 10", "5 principales". Devuelve null si no hay número.
 */
export function extraerTopN(texto: string): number | null {
  const patrones = [
    /\btop\s*(\d{1,3})\b/,
    /\bprimeros?\s+(\d{1,3})\b/,
    /\blos\s+(\d{1,3})\s+(?:mayores|mas|primeros|principales|top)/,
    /\b(\d{1,3})\s+(?:mayores|principales|primeros|mas grandes|mas altos|top)\b/,
    /\bmayores\s+(\d{1,3})\b/,
  ];
  for (const re of patrones) {
    const m = texto.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n > 0 && n <= 200) return n;
    }
  }
  return null;
}

/** Palabras en número escrito → dígito (para "los tres mayores"). */
const NUM_PALABRA: Record<string, number> = {
  un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20,
};

export function extraerTopNPalabra(texto: string): number | null {
  const m = texto.match(/\b(un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte)\s+(?:mayores|principales|primeros|clientes|proveedores|marcas|lineas)/);
  if (m) return NUM_PALABRA[m[1]!] ?? null;
  return null;
}

import type { Metrica } from "./tipos";
export type { Metrica };

/** Métrica pedida. Por defecto "venta". */
export function extraerMetrica(texto: string): Metrica {
  if (tieneAlguna(texto, ["margen", "% util", "porcentaje de util", "rentabilidad"])) return "margen";
  if (tieneAlguna(texto, ["utilidad", "ganancia", "beneficio"])) return "utilidad";
  if (tieneAlguna(texto, ["costo", "coste"])) return "costo";
  return "venta";
}

/** ¿Pide un ranking/top (mayor a menor) explícita o implícitamente? */
export function pideRanking(texto: string): boolean {
  return tieneAlguna(texto, [
    "top", "mayores", "mayor", "principales", "primeros", "ranking",
    "mas vend", "mas alto", "mas grande", "los mejores", "mejores",
  ]);
}

/** Señal de que la pregunta es "cuál/qué es el mejor/peor …". */
export function pideExtremo(texto: string): "mejor" | "peor" | null {
  if (tieneAlguna(texto, ["mejor", "mas vend", "mas alto", "mas grande", "que mas", "cual mas", "el que mas"])) return "mejor";
  if (tieneAlguna(texto, ["peor", "menos vend", "mas bajo", "que menos", "el que menos", "mas flojo"])) return "peor";
  return null;
}
