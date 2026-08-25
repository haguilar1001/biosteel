// ==========================================================
// Barra de filtros común al Informe de Pedidos y a su detalle: Año · Mes ·
// Día · Ciudad · Cliente · Marca · Línea · Anatomía · Estado. Son los mismos
// segmentadores de la página PEDIDOS del tablero de Power BI, y viajan por
// querystring para que cualquier vista sea enlazable y compartible.
//
// Las Sugerencias de Compra NO usan esta barra: filtran por otra cosa
// (proveedor, modelo de compra, parámetros de reposición) y no tienen mes,
// porque miran una ventana de meses, no un periodo.
// ==========================================================
import {
  aniosConPedidos, mesesConPedidos, diasConPedidos,
  ciudadesConPedidos, clientesConPedidos, marcasConPedidos,
  lineasConPedidos, anatomiasConPedidos, estadosConPedidos,
  MES_LARGO, type FiltroPedidos,
} from "@/lib/negocio/pedidos";

export interface ParamsPedidos {
  anio?: string; mes?: string; dia?: string;
  ciudad?: string; cliente?: string; marca?: string;
  linea?: string; anatomia?: string; estado?: string;
}

export interface ContextoFiltro {
  filtro: FiltroPedidos;
  anios: number[];
  meses: number[];
  dias: number[];
  ciudades: string[];
  clientes: string[];
  marcas: string[];
  lineas: string[];
  anatomias: string[];
  estados: string[];
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
export async function resolverFiltro(sp: ParamsPedidos): Promise<ContextoFiltro | null> {
  const anios = await aniosConPedidos();
  if (!anios.length) return null;

  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const meses = await mesesConPedidos(anio);
  const mes = sp.mes && meses.includes(Number(sp.mes)) ? Number(sp.mes) : undefined;
  const dias = mes ? await diasConPedidos(anio, mes) : [];
  const dia = mes && sp.dia && dias.includes(Number(sp.dia)) ? Number(sp.dia) : undefined;

  const [ciudades, clientes, marcas, lineas, anatomias, estados] = await Promise.all([
    ciudadesConPedidos(anio), clientesConPedidos(anio), marcasConPedidos(anio),
    lineasConPedidos(anio), anatomiasConPedidos(anio), estadosConPedidos(anio),
  ]);
  const ciudad = sp.ciudad && ciudades.includes(sp.ciudad) ? sp.ciudad : undefined;
  const cliente = sp.cliente && clientes.includes(sp.cliente) ? sp.cliente : undefined;
  const marca = sp.marca && marcas.includes(sp.marca) ? sp.marca : undefined;
  const linea = sp.linea && lineas.includes(sp.linea) ? sp.linea : undefined;
  const anatomia = sp.anatomia && anatomias.includes(sp.anatomia) ? sp.anatomia : undefined;
  const estado = sp.estado && estados.includes(sp.estado) ? sp.estado : undefined;

  const filtro: FiltroPedidos = { anio, mes, dia, ciudad, cliente, marca, linea, anatomia, estado };

  const partes = [String(anio)];
  if (mes) partes.unshift(MES_LARGO[mes]!);
  const etiqueta = dia ? `${dia} de ${MES_LARGO[mes!]} ${anio}` : partes.join(" ");

  const qs = new URLSearchParams({ anio: String(anio) });
  if (mes) qs.set("mes", String(mes));
  if (dia) qs.set("dia", String(dia));
  if (ciudad) qs.set("ciudad", ciudad);
  if (cliente) qs.set("cliente", cliente);
  if (marca) qs.set("marca", marca);
  if (linea) qs.set("linea", linea);
  if (anatomia) qs.set("anatomia", anatomia);
  if (estado) qs.set("estado", estado);

  return { filtro, anios, meses, dias, ciudades, clientes, marcas, lineas, anatomias, estados, etiqueta, query: qs.toString() };
}

/** Descripción corta de los filtros activos, bajo el título de cada pantalla. */
export function resumenFiltros(c: ContextoFiltro): string {
  const f = c.filtro;
  const partes: string[] = [f.ciudad ?? "Todas las ciudades"];
  if (f.cliente) partes.push(f.cliente);
  if (f.marca) partes.push(f.marca);
  if (f.linea) partes.push(f.linea);
  if (f.anatomia) partes.push(f.anatomia);
  if (f.estado) partes.push(f.estado);
  return partes.join(" · ");
}

/** true si hay algún filtro más allá del año (para ofrecer "Limpiar"). */
export function hayFiltros(c: ContextoFiltro): boolean {
  const f = c.filtro;
  return Boolean(f.mes || f.dia || f.ciudad || f.cliente || f.marca || f.linea || f.anatomia || f.estado);
}
