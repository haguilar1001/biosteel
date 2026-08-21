// ==========================================================
// Barra de filtros común a las cuatro pantallas de Compras: Año · Mes · Día ·
// Proveedor · Línea · Tipo de compra. Son los mismos segmentadores del
// tablero de Power BI, y viajan por querystring para que cualquier vista sea
// enlazable y compartible.
// ==========================================================
import {
  aniosConCompras, mesesConCompras, diasConCompras,
  proveedoresConCompras, lineasConCompras, tiposDeCompra,
  MES_LARGO, type FiltroCompras,
} from "@/lib/negocio/compras";

export interface ParamsCompras {
  anio?: string; mes?: string; dia?: string;
  prov?: string; linea?: string; tipo?: string;
}

export interface ContextoFiltro {
  filtro: FiltroCompras;
  anios: number[];
  meses: number[];
  dias: number[];
  proveedores: string[];
  lineas: string[];
  tipos: string[];
  /** Texto del periodo para los encabezados ("11 de Agosto 2026"). */
  etiqueta: string;
  /** Querystring con el filtro vigente, para los enlaces de exportación. */
  query: string;
}

/**
 * Resuelve el filtro contra lo que realmente hay cargado: un año o un mes que
 * no existan se caen al último disponible en vez de mostrar una vista vacía.
 * Devuelve null si no hay nada cargado todavía.
 */
export async function resolverFiltro(sp: ParamsCompras): Promise<ContextoFiltro | null> {
  const anios = await aniosConCompras();
  if (!anios.length) return null;

  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const meses = await mesesConCompras(anio);
  const mes = sp.mes && meses.includes(Number(sp.mes)) ? Number(sp.mes) : undefined;
  const dias = mes ? await diasConCompras(anio, mes) : [];
  const dia = mes && sp.dia && dias.includes(Number(sp.dia)) ? Number(sp.dia) : undefined;

  const [proveedores, lineas, tipos] = await Promise.all([
    proveedoresConCompras(anio), lineasConCompras(anio), tiposDeCompra(),
  ]);
  const proveedor = sp.prov && proveedores.includes(sp.prov) ? sp.prov : undefined;
  const linea = sp.linea && lineas.includes(sp.linea) ? sp.linea : undefined;
  const tipoCompra = sp.tipo && tipos.includes(sp.tipo) ? sp.tipo : undefined;

  const filtro: FiltroCompras = { anio, mes, dia, proveedor, linea, tipoCompra };

  const partes = [String(anio)];
  if (mes) partes.unshift(MES_LARGO[mes]!);
  if (dia) partes.unshift(String(dia));
  const etiqueta = dia ? `${dia} de ${MES_LARGO[mes!]} ${anio}` : partes.join(" ");

  const qs = new URLSearchParams({ anio: String(anio) });
  if (mes) qs.set("mes", String(mes));
  if (dia) qs.set("dia", String(dia));
  if (proveedor) qs.set("prov", proveedor);
  if (linea) qs.set("linea", linea);
  if (tipoCompra) qs.set("tipo", tipoCompra);

  return { filtro, anios, meses, dias, proveedores, lineas, tipos, etiqueta, query: qs.toString() };
}

/** Descripción corta de los filtros activos, bajo el título de cada pantalla. */
export function resumenFiltros(c: ContextoFiltro): string {
  const f = c.filtro;
  const partes: string[] = [];
  partes.push(f.proveedor ?? "Todos los proveedores");
  if (f.linea) partes.push(f.linea);
  if (f.tipoCompra) partes.push(f.tipoCompra);
  return partes.join(" · ");
}
