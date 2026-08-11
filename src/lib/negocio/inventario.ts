// ==========================================================
// Lógica: Inventario de Equipos.
// Consultas para la tabla maestra y los informes por Ciudad y por Estado,
// más catálogos para los formularios y la bitácora de novedades.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import type { EstadoInventario, TipoItemInventario, TipoNovedad } from "@prisma/client";

// ---------- Etiquetas y estilos ----------

export const ESTADOS: EstadoInventario[] = ["activo", "en_reparacion", "de_baja", "pendiente"];

export function estadoLabel(e: EstadoInventario): string {
  return { activo: "Activo", en_reparacion: "En reparación", de_baja: "De baja", pendiente: "Pendiente" }[e];
}
/** Clase de badge (misma paleta que el resto de la app). */
export function estadoClase(e: EstadoInventario): string {
  return { activo: "t-ok", en_reparacion: "t-w1", de_baja: "t-bad", pendiente: "t-blue" }[e];
}
export function estadoIcono(e: EstadoInventario): string {
  return { activo: "✅", en_reparacion: "🔧", de_baja: "🚫", pendiente: "⏳" }[e];
}

export function tipoLabel(t: TipoItemInventario): string {
  return { equipo: "Equipo", accesorio: "Accesorio" }[t];
}

export function novedadLabel(t: TipoNovedad): string {
  return {
    compra: "Compra / Alta",
    baja: "Baja",
    dano: "Daño",
    reparacion: "Envío a reparación",
    retorno_reparacion: "Retorno de reparación",
    traslado: "Traslado entre sedes",
  }[t];
}
export function novedadIcono(t: TipoNovedad): string {
  return { compra: "🆕", baja: "🚫", dano: "⚠️", reparacion: "🔧", retorno_reparacion: "↩️", traslado: "🚚" }[t];
}

// ---------- Tipos de salida ----------

export interface ItemVista {
  id: number;
  descripcion: string;
  tipo: TipoItemInventario;
  cantidad: number;
  lote: string | null;
  estado: EstadoInventario;
  observaciones: string | null;
}

export interface EquipoVista {
  id: number;
  sedeId: number;
  sede: string;
  ciudad: string;
  categoria: string;
  marca: string;
  nombre: string | null;
  observaciones: string | null;
  items: ItemVista[];
  totalItems: number;   // suma de cantidades
  estados: Record<EstadoInventario, number>; // conteo de ítems por estado
}

// ---------- Consultas ----------

/** Todos los equipos con sus ítems y sede, ordenados por ciudad/categoría/marca. */
export async function listarEquipos(): Promise<EquipoVista[]> {
  const equipos = await prisma.equipoInventario.findMany({
    include: { sede: true, items: { orderBy: { id: "asc" } } },
    orderBy: [{ sede: { ciudad: "asc" } }, { categoria: "asc" }, { marca: "asc" }],
  });

  return equipos.map((e) => {
    const estados: Record<EstadoInventario, number> = { activo: 0, en_reparacion: 0, de_baja: 0, pendiente: 0 };
    let total = 0;
    for (const it of e.items) {
      estados[it.estado] += 1;
      total += it.cantidad;
    }
    return {
      id: e.id,
      sedeId: e.sedeId,
      sede: e.sede.nombre,
      ciudad: e.sede.ciudad,
      categoria: e.categoria,
      marca: e.marca,
      nombre: e.nombre,
      observaciones: e.observaciones,
      items: e.items.map((it) => ({
        id: it.id,
        descripcion: it.descripcion,
        tipo: it.tipo,
        cantidad: it.cantidad,
        lote: it.lote,
        estado: it.estado,
        observaciones: it.observaciones,
      })),
      totalItems: total,
      estados,
    };
  });
}

export interface ResumenInventario {
  totalEquipos: number;
  totalItems: number;      // suma de cantidades
  totalRegistros: number;  // filas de ítem
  ciudades: number;
  porEstado: Record<EstadoInventario, number>;
}

/** KPIs generales del inventario. */
export async function resumenInventario(): Promise<ResumenInventario> {
  const equipos = await listarEquipos();
  const porEstado: Record<EstadoInventario, number> = { activo: 0, en_reparacion: 0, de_baja: 0, pendiente: 0 };
  let totalItems = 0;
  let totalRegistros = 0;
  const ciudades = new Set<string>();
  for (const e of equipos) {
    ciudades.add(e.ciudad);
    for (const it of e.items) {
      porEstado[it.estado] += it.cantidad;
      totalItems += it.cantidad;
      totalRegistros += 1;
    }
  }
  return { totalEquipos: equipos.length, totalItems, totalRegistros, ciudades: ciudades.size, porEstado };
}

export interface GrupoCiudad {
  ciudad: string;
  sede: string;
  totalItems: number;
  porEstado: Record<EstadoInventario, number>;
  equipos: EquipoVista[];
}

/** Inventario agrupado por ciudad/sede (informe "Por Ciudad"). */
export async function inventarioPorCiudad(): Promise<GrupoCiudad[]> {
  const equipos = await listarEquipos();
  const mapa = new Map<string, GrupoCiudad>();
  for (const e of equipos) {
    let g = mapa.get(e.ciudad);
    if (!g) {
      g = { ciudad: e.ciudad, sede: e.sede, totalItems: 0, porEstado: { activo: 0, en_reparacion: 0, de_baja: 0, pendiente: 0 }, equipos: [] };
      mapa.set(e.ciudad, g);
    }
    g.equipos.push(e);
    for (const it of e.items) {
      g.totalItems += it.cantidad;
      g.porEstado[it.estado] += it.cantidad;
    }
  }
  return [...mapa.values()].sort((a, b) => b.totalItems - a.totalItems);
}

export interface FilaEstadoCiudad {
  estado: EstadoInventario;
  porCiudad: Record<string, number>;
  total: number;
}
export interface InformeEstados {
  ciudades: string[];
  filas: FilaEstadoCiudad[];
  totalPorCiudad: Record<string, number>;
  total: number;
  porEstado: Record<EstadoInventario, number>;
}

/** Matriz Estado × Ciudad (informe "Por Estado"). */
export async function inventarioPorEstado(): Promise<InformeEstados> {
  const equipos = await listarEquipos();
  const ciudadesSet = new Set<string>();
  const filas: Record<EstadoInventario, Record<string, number>> = {
    activo: {}, en_reparacion: {}, de_baja: {}, pendiente: {},
  };
  const totalPorCiudad: Record<string, number> = {};
  const porEstado: Record<EstadoInventario, number> = { activo: 0, en_reparacion: 0, de_baja: 0, pendiente: 0 };
  let total = 0;

  for (const e of equipos) {
    ciudadesSet.add(e.ciudad);
    for (const it of e.items) {
      filas[it.estado][e.ciudad] = (filas[it.estado][e.ciudad] ?? 0) + it.cantidad;
      totalPorCiudad[e.ciudad] = (totalPorCiudad[e.ciudad] ?? 0) + it.cantidad;
      porEstado[it.estado] += it.cantidad;
      total += it.cantidad;
    }
  }

  const ciudades = [...ciudadesSet].sort();
  const filasArr: FilaEstadoCiudad[] = ESTADOS.map((estado) => {
    const porCiudad: Record<string, number> = {};
    let t = 0;
    for (const c of ciudades) {
      const v = filas[estado][c] ?? 0;
      porCiudad[c] = v;
      t += v;
    }
    return { estado, porCiudad, total: t };
  });

  return { ciudades, filas: filasArr, totalPorCiudad, total, porEstado };
}

export interface Composicion {
  porCategoria: { label: string; valor: number }[];
  porMarca: { label: string; valor: number }[];
  porCiudadEstado: { ciudad: string; total: number; estados: Record<EstadoInventario, number> }[];
}

/** Conteos de ítems por categoría, marca y ciudad×estado (para los gráficos). */
export async function composicionInventario(): Promise<Composicion> {
  const equipos = await listarEquipos();
  const cat = new Map<string, number>();
  const marca = new Map<string, number>();
  const ciudad = new Map<string, { total: number; estados: Record<EstadoInventario, number> }>();

  for (const e of equipos) {
    const itemsCant = e.items.reduce((a, i) => a + i.cantidad, 0);
    cat.set(e.categoria, (cat.get(e.categoria) ?? 0) + itemsCant);
    marca.set(e.marca, (marca.get(e.marca) ?? 0) + itemsCant);
    let c = ciudad.get(e.ciudad);
    if (!c) { c = { total: 0, estados: { activo: 0, en_reparacion: 0, de_baja: 0, pendiente: 0 } }; ciudad.set(e.ciudad, c); }
    for (const it of e.items) {
      c.total += it.cantidad;
      c.estados[it.estado] += it.cantidad;
    }
  }
  const toArr = (m: Map<string, number>) => [...m.entries()].map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
  return {
    porCategoria: toArr(cat),
    porMarca: toArr(marca),
    porCiudadEstado: [...ciudad.entries()].map(([c, v]) => ({ ciudad: c, ...v })).sort((a, b) => b.total - a.total),
  };
}

// ---------- Catálogos para formularios ----------

export interface Catalogos {
  sedes: { id: number; nombre: string; ciudad: string }[];
  categorias: string[];
  marcas: string[];
}

export async function catalogos(): Promise<Catalogos> {
  const [sedes, equipos] = await Promise.all([
    prisma.sede.findMany({ where: { activo: true }, orderBy: { ciudad: "asc" } }),
    prisma.equipoInventario.findMany({ select: { categoria: true, marca: true } }),
  ]);
  const categorias = [...new Set(equipos.map((e) => e.categoria))].sort();
  const marcas = [...new Set(equipos.map((e) => e.marca))].sort();
  return {
    sedes: sedes.map((s) => ({ id: s.id, nombre: s.nombre, ciudad: s.ciudad })),
    categorias,
    marcas,
  };
}

export interface NovedadVista {
  id: number;
  fecha: Date;
  tipo: TipoNovedad;
  equipo: string;       // "Categoría · Marca"
  ciudad: string;
  itemDescripcion: string | null;
  sedeOrigen: string | null;
  sedeDestino: string | null;
  estadoAnterior: EstadoInventario | null;
  estadoNuevo: EstadoInventario | null;
  descripcion: string | null;
  usuario: string | null;
}

/** Bitácora de novedades, más reciente primero. */
export async function listarNovedades(limite = 200): Promise<NovedadVista[]> {
  const novedades = await prisma.novedadInventario.findMany({
    take: limite,
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    include: { equipo: { include: { sede: true } }, usuario: { select: { nombre: true } } },
  });
  const sedeIds = new Set<number>();
  for (const n of novedades) {
    if (n.sedeOrigenId) sedeIds.add(n.sedeOrigenId);
    if (n.sedeDestinoId) sedeIds.add(n.sedeDestinoId);
  }
  const sedes = await prisma.sede.findMany({ where: { id: { in: [...sedeIds] } } });
  const sedeNombre = new Map(sedes.map((s) => [s.id, s.nombre]));

  const itemIds = novedades.map((n) => n.itemId).filter((x): x is number => x != null);
  const items = itemIds.length
    ? await prisma.itemInventario.findMany({ where: { id: { in: itemIds } }, select: { id: true, descripcion: true } })
    : [];
  const itemDesc = new Map(items.map((i) => [i.id, i.descripcion]));

  return novedades.map((n) => ({
    id: n.id,
    fecha: n.fecha,
    tipo: n.tipo,
    equipo: `${n.equipo.categoria} · ${n.equipo.marca}`,
    ciudad: n.equipo.sede.ciudad,
    itemDescripcion: n.itemId ? itemDesc.get(n.itemId) ?? null : null,
    sedeOrigen: n.sedeOrigenId ? sedeNombre.get(n.sedeOrigenId) ?? null : null,
    sedeDestino: n.sedeDestinoId ? sedeNombre.get(n.sedeDestinoId) ?? null : null,
    estadoAnterior: n.estadoAnterior,
    estadoNuevo: n.estadoNuevo,
    descripcion: n.descripcion,
    usuario: n.usuario?.nombre ?? null,
  }));
}
