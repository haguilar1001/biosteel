// ==========================================================
// Registro UNIFICADO de cargas de archivos (formulario in-app /cargar).
// Cada dataset tiene: clave, título, PERMISO (uno por archivo) y un procesador
// que recibe el buffer y devuelve un ResultadoDataset normalizado.
// Delega en los motores existentes:
//   · SIESA (pendientes/ventas/facturacion/gastos/anuladas) → procesarCarga
//   · Estado de Resultados (pyg) → parsePygExcel / persistirPyg
//   · Ingresos y Egresos (flujo) → sincronizarFlujoDesdeBuffer
// El control de acceso (sesión + permiso por dataset) vive en la API/página.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { PermisoClave } from "@/lib/rbac/permissions";
import { procesarCarga, type ResultadoDataset, type DatasetKey } from "./carga-siesa";
import { parsePygExcel, persistirPyg } from "./importar-pyg-excel";
import { sincronizarFlujoDesdeBuffer } from "./sync-flujo";
import { parsePresupuesto, persistirPresupuesto } from "./importar-presupuesto";
import {
  parseTablasAuxiliares, persistirBodegas,
  parseBalance, persistirBalance,
  parseMovimientos, persistirMovimientos,
} from "./importar-inventario";
import {
  parseOrdenes, persistirOrdenes,
  parsePendientesDespacho, persistirPendientesDespacho,
  parseFacturasProveedor, persistirFacturasProveedor,
  parseTiposProveedor, persistirTiposProveedor,
} from "./importar-compras";

export type CargaClave = DatasetKey | "pyg" | "flujo" | "presupuesto"
  | "inv-bodegas" | "inv-balance" | "inv-movimientos"
  | "compras-tipos" | "compras-ordenes" | "compras-pendientes" | "compras-facturas";

export interface CargaDef {
  clave: CargaClave;
  titulo: string;
  permiso: PermisoClave;
  archivoSugerido: string;
  procesar(buffer: Buffer, nombre: string, ip?: string): Promise<ResultadoDataset>;
}

const nf = new Intl.NumberFormat("es-CO");

/** Procesa un dataset SIESA reutilizando procesarCarga (un archivo a la vez). */
async function procesarSiesa(clave: DatasetKey, titulo: string, buffer: Buffer, nombre: string, ip?: string): Promise<ResultadoDataset> {
  const res = await procesarCarga([{ clave, nombre, buffer }], ip, false);
  const d = res.datasets[clave];
  if (!d) throw new Error(res.errores[0] ?? "No se pudo procesar el archivo.");
  return { ...d, titulo };
}

export const CARGAS: CargaDef[] = [
  {
    clave: "pendientes", titulo: "Pedidos Pendientes", permiso: "carga.pendientes",
    archivoSugerido: "PEDIDOS PENDIENTES ACUMULADOS.xlsx",
    procesar: (b, n, ip) => procesarSiesa("pendientes", "Pedidos Pendientes", b, n, ip),
  },
  {
    clave: "ventas", titulo: "Ventas x Item", permiso: "carga.ventas",
    archivoSugerido: "2026.xlsx",
    procesar: (b, n, ip) => procesarSiesa("ventas", "Ventas x Item", b, n, ip),
  },
  {
    clave: "facturacion", titulo: "Facturación por Usuario", permiso: "carga.facturacion",
    archivoSugerido: "DATOS FACTURACIÓN.xlsx",
    procesar: (b, n, ip) => procesarSiesa("facturacion", "Facturación por Usuario", b, n, ip),
  },
  {
    clave: "gastos", titulo: "Gastos", permiso: "carga.gastos",
    archivoSugerido: "GASTOS.xlsx",
    procesar: (b, n, ip) => procesarSiesa("gastos", "Gastos", b, n, ip),
  },
  {
    clave: "anuladas", titulo: "Facturas Anuladas", permiso: "carga.anuladas",
    archivoSugerido: "MOTIVO FACTURAS ANULADAS.xlsx",
    procesar: (b, n, ip) => procesarSiesa("anuladas", "Facturas Anuladas", b, n, ip),
  },
  {
    clave: "pyg", titulo: "Estado de Resultados", permiso: "carga.pyg",
    archivoSugerido: "E.R. Consolidado 2026.xlsx",
    async procesar(buffer, nombre) {
      const anio = new Date().getFullYear();
      const { hoja, meses, omitidas } = parsePygExcel(buffer);
      if (!meses.length) throw new Error("No se encontró ninguna hoja-mes válida (ENERO…DICIEMBRE) con los totales del Estado de Resultados.");
      const cargadas = await persistirPyg(prisma, Prisma, anio, meses);
      const etiquetaMeses = meses.map((m) => m.mes).sort((a, b) => a - b);
      return {
        titulo: "Estado de Resultados", archivo: nombre, hoja,
        filas: meses.length, cargadas, omitidas,
        estrategia: `upsert ${anio}: ${cargadas} mes(es) [${etiquetaMeses.join(", ")}] agregados/actualizados`,
      };
    },
  },
  {
    clave: "flujo", titulo: "Ingresos y Egresos", permiso: "carga.flujo",
    archivoSugerido: "Flujo de Caja Diario.xlsx",
    async procesar(buffer, nombre, ip) {
      const r = await sincronizarFlujoDesdeBuffer(buffer, ip, false);
      if (!r.ok) throw new Error(r.error ?? "No se pudo procesar el flujo de caja.");
      const cats = r.categoriasCreadas.length ? ` · ${r.categoriasCreadas.length} categoría(s) nueva(s)` : "";
      return {
        titulo: "Ingresos y Egresos", archivo: nombre, hoja: "Flujo Caja",
        filas: r.movimientos + r.omitidas, cargadas: r.movimientos, omitidas: r.omitidas,
        estrategia: `reemplaza año(s) ${r.anios.join(", ")}: ${nf.format(r.movimientos)} movimientos (ing. ${nf.format(r.ingresos)} / egr. ${nf.format(r.egresos)})${cats}`,
      };
    },
  },
  {
    clave: "presupuesto", titulo: "Presupuesto de Egresos", permiso: "carga.presupuesto",
    archivoSugerido: "PRESUPUESTO BIO STEEL PROYECTADO 2026.xlsx",
    async procesar(buffer, nombre) {
      const anio = new Date().getFullYear();
      const parse = parsePresupuesto(buffer);
      if (!parse.filas.length) throw new Error("No se encontraron valores de presupuesto (hoja Presupuesto_Terceros, columnas ENE..DIC).");
      const { cargadas, meses } = await persistirPresupuesto(prisma, anio, parse);
      return {
        titulo: "Presupuesto de Egresos", archivo: nombre, hoja: parse.hoja,
        filas: parse.filas.length, cargadas, omitidas: parse.omitidas,
        estrategia: `reemplaza ${anio} meses [${meses.join(", ")}]: ${nf.format(cargadas)} renglones de presupuesto`,
      };
    },
  },
  // --- Inventario de material de osteosíntesis ---
  // El orden importa: los movimientos se rechazan si su bodega no está en el
  // catálogo, así que las Tablas Auxiliares se cargan primero.
  {
    clave: "inv-bodegas", titulo: "Inventario · Tablas Auxiliares", permiso: "carga.inv.bodegas",
    archivoSugerido: "TABLAS AUXILIARES.xlsx",
    async procesar(buffer, nombre) {
      const bodegas = parseTablasAuxiliares(buffer);
      const cargadas = await persistirBodegas(bodegas);
      const inferidas = bodegas.filter((b) => b.inferida).length;
      const porInst = [101, 102, 106].map((i) => `${i}: ${bodegas.filter((b) => b.instalacion === i).length}`).join(" · ");
      return {
        titulo: "Inventario · Tablas Auxiliares", archivo: nombre, hoja: "CÓDIGOS DE BODEGA",
        filas: bodegas.length, cargadas, omitidas: 0,
        estrategia: `upsert de ${cargadas} bodega(s) [${porInst}]${inferidas ? ` · ${inferidas} con instalación inferida (no venían en el catálogo)` : ""}`,
      };
    },
  },
  {
    clave: "inv-balance", titulo: "Inventario · Balance mensual", permiso: "carga.inv.balance",
    archivoSugerido: "1. BALANCE ENERO.xlsx",
    async procesar(buffer, nombre) {
      const b = await parseBalance(buffer, nombre);
      if (!b.datos.length) throw new Error("El balance no trae ninguna fila con saldo o movimiento.");
      const cargadas = await persistirBalance(b);
      const detalle = b.porBodega ? "por bodega" : "solo por instalación (export viejo, sin columna Bodega)";
      const desc = b.descRellenadas || b.descFaltantes
        ? ` · el archivo no trae "Desc. item": ${nf.format(b.descRellenadas)} descripciones rellenadas desde lo ya cargado${b.descFaltantes ? `, ${nf.format(b.descFaltantes)} sin fuente` : ""}`
        : "";
      const nuevas = b.bodegasNuevas.size ? ` · ${b.bodegasNuevas.size} bodega(s) dadas de alta: ${[...b.bodegasNuevas.keys()].join(", ")}` : "";
      const choques = b.choques.size
        ? ` · ${b.choques.size} bodega(s) donde manda el balance sobre el catálogo: ${[...b.choques].map(([c, x]) => `${c} (${x.catalogo}→${x.archivo})`).join(", ")}`
        : "";
      return {
        titulo: "Inventario · Balance mensual", archivo: nombre, hoja: b.hoja,
        filas: b.filas, cargadas, omitidas: b.filas - cargadas,
        estrategia: `reemplaza ${b.mes}/${b.anio} ${detalle}: ${nf.format(cargadas)} fila(s) con saldo o movimiento (se descartan las que están en cero)${desc}${nuevas}${choques}`,
      };
    },
  },
  {
    clave: "inv-movimientos", titulo: "Inventario · Movimientos", permiso: "carga.inv.movimientos",
    archivoSugerido: "MOVIMIENTOS DE INVENTARIO.xlsx",
    async procesar(buffer, nombre) {
      const catalogo = new Map((await prisma.invBodega.findMany({ select: { codigo: true, instalacion: true } })).map((b) => [b.codigo, b.instalacion]));
      const m = parseMovimientos(buffer, catalogo);
      if (!m.datos.length) throw new Error("El archivo no trae movimientos con instalación identificable.");
      const cargadas = await persistirMovimientos(m);
      const nuevas = m.bodegasNuevas.size ? ` · ${m.bodegasNuevas.size} bodega(s) dadas de alta desde el archivo [${[...m.bodegasNuevas.keys()].join(", ")}]` : "";
      const choque = m.choques.size ? ` · ${m.choques.size} bodega(s) donde el catálogo dice otra instalación (manda el archivo): ${[...m.choques].map(([k, v]) => `${k} ${v.catalogo}→${v.archivo}`).join(", ")}` : "";
      const sinBodega = m.bodegasDesconocidas.size
        ? ` · OJO: ${m.bodegasDesconocidas.size} bodega(s) sin instalación quedaron fuera [${[...m.bodegasDesconocidas.keys()].join(", ")}]`
        : "";
      return {
        titulo: "Inventario · Movimientos", archivo: nombre, hoja: m.hoja,
        filas: m.filas, cargadas, omitidas: m.filas - cargadas,
        estrategia: `reemplaza ${m.periodos.length} periodo(s) [${m.periodos[0]} … ${m.periodos[m.periodos.length - 1]}]: ${nf.format(cargadas)} movimientos${nuevas}${choque}${sinBodega}`,
      };
    },
  },
  // --- Compras ---
  // El catálogo de tipos va primero: es el que alimenta el filtro "tipo de
  // compra" del informe. Los otros tres son independientes entre sí.
  {
    clave: "compras-tipos", titulo: "Compras · Tipos de Proveedores", permiso: "carga.compras.tipos",
    archivoSugerido: "TIPOS DE PROVEEDORES.xlsx",
    async procesar(buffer, nombre) {
      const lista = parseTiposProveedor(buffer);
      if (!lista.length) throw new Error("El archivo no trae ningún proveedor con tipo de compra.");
      const cargadas = await persistirTiposProveedor(lista);
      const tipos = [...new Set(lista.map((p) => p.tipoCompra))].filter(Boolean);
      return {
        titulo: "Compras · Tipos de Proveedores", archivo: nombre, hoja: "TIPOS DE PROVEEDORES",
        filas: lista.length, cargadas, omitidas: 0,
        estrategia: `upsert de ${nf.format(cargadas)} proveedor(es) · tipos: ${tipos.join(", ")}`,
      };
    },
  },
  {
    clave: "compras-ordenes", titulo: "Compras · Órdenes de Compra", permiso: "carga.compras.ordenes",
    archivoSugerido: "ORDENES DE COMPRA.xlsx",
    async procesar(buffer, nombre) {
      const p = parseOrdenes(buffer);
      if (!p.datos.length) throw new Error("El archivo no trae órdenes con fecha válida.");
      const cargadas = await persistirOrdenes(p);
      const ordenes = new Set(p.datos.map((d) => d.nroOrden)).size;
      const total = p.datos.reduce((a, d) => a + Number(d.valorNeto), 0);
      return {
        titulo: "Compras · Órdenes de Compra", archivo: nombre, hoja: p.hoja,
        filas: p.filas, cargadas, omitidas: p.omitidas,
        estrategia: `reemplaza ${p.periodos.length} periodo(s) [${p.periodos[0]} … ${p.periodos[p.periodos.length - 1]}]: ${nf.format(cargadas)} renglones · ${nf.format(ordenes)} órdenes · ${nf.format(Math.round(total))}`,
      };
    },
  },
  {
    clave: "compras-pendientes", titulo: "Compras · Pendientes por Despacho", permiso: "carga.compras.pendientes",
    archivoSugerido: "PENDIENTES POR DESPACHO.xlsx",
    async procesar(buffer, nombre) {
      const p = parsePendientesDespacho(buffer);
      if (!p.datos.length) throw new Error("El archivo no trae pendientes con fecha válida.");
      const cargadas = await persistirPendientesDespacho(p);
      const ordenes = new Set(p.datos.map((d) => d.nroOrden)).size;
      const total = p.datos.reduce((a, d) => a + Number(d.valorPendiente), 0);
      return {
        titulo: "Compras · Pendientes por Despacho", archivo: nombre, hoja: p.hoja,
        filas: p.filas, cargadas, omitidas: p.omitidas,
        estrategia: `reemplaza TODA la foto anterior: ${nf.format(cargadas)} renglones · ${nf.format(ordenes)} órdenes pendientes · ${nf.format(Math.round(total))}`,
      };
    },
  },
  {
    clave: "compras-facturas", titulo: "Compras · Facturas de Proveedores", permiso: "carga.compras.facturas",
    archivoSugerido: "FACTURAS PROVEEDORES.xlsx",
    async procesar(buffer, nombre) {
      const p = parseFacturasProveedor(buffer);
      if (!p.datos.length) throw new Error("El archivo no trae documentos con fecha válida.");
      const cargadas = await persistirFacturasProveedor(p);
      const total = p.datos.reduce((a, d) => a + Number(d.valorNeto), 0);
      return {
        titulo: "Compras · Facturas de Proveedores", archivo: nombre, hoja: p.hoja,
        filas: p.filas, cargadas, omitidas: p.omitidas,
        estrategia: `reemplaza ${p.periodos.length} periodo(s) [${p.periodos[0]} … ${p.periodos[p.periodos.length - 1]}]: ${nf.format(cargadas)} documentos · ${nf.format(Math.round(total))}`,
      };
    },
  },
];

export function cargaDef(clave: string): CargaDef | undefined {
  return CARGAS.find((c) => c.clave === clave);
}
