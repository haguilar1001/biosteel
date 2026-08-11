// ==========================================================
// Catálogo de categorías de flujo + clasificador automático.
// Módulo puro (sin BD): lo usan el importador, el seed y las pruebas.
//
// La clasificación mira el texto de la novedad ("Notas" del ERP) y, según
// palabras clave, asigna una categoría. Reglas por dirección (ingreso/egreso),
// en orden de prioridad: la PRIMERA que coincide gana.
// ==========================================================
import type { TipoMovimiento } from "@prisma/client";

export interface CategoriaDef {
  nombre: string;
  tipo: TipoMovimiento;
  orden: number;
}

// Catálogo canónico. Ingresos 10–90, egresos 110–190 (ordenan juntos).
export const CATEGORIAS_FLUJO: CategoriaDef[] = [
  // Ingresos
  { nombre: "Recaudo de cartera", tipo: "ingreso", orden: 10 },
  { nombre: "Financiación recibida", tipo: "ingreso", orden: 20 },
  { nombre: "Devoluciones y reintegros", tipo: "ingreso", orden: 30 },
  { nombre: "Otros ingresos", tipo: "ingreso", orden: 90 },
  // Egresos
  { nombre: "Proveedores", tipo: "egreso", orden: 110 },
  { nombre: "Nómina y prestaciones", tipo: "egreso", orden: 120 },
  { nombre: "Impuestos", tipo: "egreso", orden: 130 },
  { nombre: "Servicios y arriendos", tipo: "egreso", orden: 140 },
  { nombre: "Financieros y bancarios", tipo: "egreso", orden: 150 },
  { nombre: "Seguros y pólizas", tipo: "egreso", orden: 160 },
  { nombre: "Embargos y jurídicos", tipo: "egreso", orden: 170 },
  { nombre: "Otros egresos", tipo: "egreso", orden: 190 },
];

export const CAT_OTROS_INGRESO = "Otros ingresos";
export const CAT_OTROS_EGRESO = "Otros egresos";

interface Regla { categoria: string; patrones: string[] }

// Patrones ya normalizados (MAYÚSCULAS, sin tildes). Orden = prioridad.
const REGLAS_EGRESO: Regla[] = [
  { categoria: "Impuestos", patrones: ["IMPUESTO", "RETENCION", "RETEFUENTE", "RETEIVA", "RETEICA", "DIAN", "PREDIAL", "INDUSTRIA Y COMERCIO", "IVA ", "GMF", "4X1000", "4X MIL"] },
  { categoria: "Nómina y prestaciones", patrones: ["NOMINA", "PRIMA", "CESANTIA", "VACACION", "SALARIO", "LIQUIDACION", "SEGURIDAD SOCIAL", "PARAFISCAL", "APORTE", "PENSION", "PILA", "ARL", "CAJA DE COMPENSACION", "BONIFICACION"] },
  { categoria: "Seguros y pólizas", patrones: ["POLIZA", "SEGURO"] },
  { categoria: "Embargos y jurídicos", patrones: ["EMBARGO", "JUZGADO", "SENTENCIA"] },
  { categoria: "Financieros y bancarios", patrones: ["INTERES", "GASTO BANCARIO", "GASTOS BANCARIOS", "COMISION BANCARIA", "DEBITO PRESTAMO", "PRESTAMO", "CREDITO", "CUOTA", "CHEQUERA", "SOBREGIRO", "FINANCIACION"] },
  { categoria: "Servicios y arriendos", patrones: ["SERVICIO", "ARRIENDO", "ARRENDAMIENTO", "ENERGIA", "ACUEDUCTO", "ALCANTARILLADO", "TELEFON", "INTERNET", "VIGILANCIA", "ASEO", "MANTENIMIENTO", "PUBLICO"] },
  { categoria: "Proveedores", patrones: ["FACTURA", "PROVEEDOR", "COMPRA", "ANTICIPO", "MERCANCIA", "IMPORTACION", "ABONO", "PEDIDO", "INSUMO"] },
];

const REGLAS_INGRESO: Regla[] = [
  { categoria: "Financiación recibida", patrones: ["PRESTAMO", "DESEMBOLSO", "FINANCIACION", "CREDITO DESEMBOLS"] },
  { categoria: "Devoluciones y reintegros", patrones: ["DEVOLUCION", "DEV DE", "DEV.", "REINTEGRO", "REEMBOLSO", "DEV "] },
  { categoria: "Recaudo de cartera", patrones: ["APLICACION", "APLIACION", "ABONO", "RECAUDO", "CONSIGNACION", "PAGO CLIENTE", "RDC-", "CARTERA", "COBRO"] },
];

// Marcas diacríticas combinantes U+0300–U+036F (tildes, diéresis…).
const DIACRITICOS = /[̀-ͯ]/g;

/** Normaliza a MAYÚSCULAS sin tildes para comparar. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(DIACRITICOS, "").toUpperCase();
}

/** Devuelve el NOMBRE de la categoría para un movimiento (según su texto y dirección). */
export function clasificar(texto: string | null | undefined, tipo: TipoMovimiento): string {
  const t = normalizar(texto ?? "");
  const reglas = tipo === "ingreso" ? REGLAS_INGRESO : REGLAS_EGRESO;
  for (const regla of reglas) {
    if (regla.patrones.some((p) => t.includes(p))) return regla.categoria;
  }
  return tipo === "ingreso" ? CAT_OTROS_INGRESO : CAT_OTROS_EGRESO;
}
