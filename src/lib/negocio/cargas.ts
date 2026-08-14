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

export type CargaClave = DatasetKey | "pyg" | "flujo" | "presupuesto";

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
];

export function cargaDef(clave: string): CargaDef | undefined {
  return CARGAS.find((c) => c.clave === clave);
}
