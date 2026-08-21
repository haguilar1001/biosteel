// ==========================================================
// Carga masiva del MÓDULO DE COMPRAS desde los Excel de SIESA.
// Mismos parsers que la carga web (/cargar), pero por consola: el archivo de
// órdenes pasa de 46.000 renglones y no entra por el formulario.
//
// Uso:   npm run db:compras
//        DIR_COMPRAS="D:/otra/ruta" npm run db:compras
//        SOLO=ordenes npm run db:compras   (ordenes|pendientes|facturas|tipos)
//
// Los archivos se buscan por nombre dentro del directorio:
//   ORDENES DE COMPRA.xlsx · PENDIENTES POR DESPACHO.xlsx
//   FACTURAS PROVEEDORES.xlsx · TABLAS AUXILIARES.xlsx (hoja TIPOS DE
//   PROVEEDORES; opcional, es lo que llena el filtro de tipo de compra)
// ==========================================================
import "./_env";
import fs from "node:fs";
import path from "node:path";
import {
  parseOrdenes, persistirOrdenes,
  parsePendientesDespacho, persistirPendientesDespacho,
  parseFacturasProveedor, persistirFacturasProveedor,
  parseTiposProveedor, persistirTiposProveedor,
} from "../src/lib/negocio/importar-compras";
import { prisma } from "../src/lib/db";

const DIR = process.env.DIR_COMPRAS ?? "D:/Escritorio";
const SOLO = process.env.SOLO ?? "";
const hacer = (paso: string) => !SOLO || SOLO === paso;
const fmt = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
const cop = (v: number) => `$${fmt(v)}`;

/** Primer archivo del directorio que cumple el predicado (SIESA varía los nombres). */
function buscar(pred: (nombre: string) => boolean): string | undefined {
  const encontrados = fs.readdirSync(DIR)
    .filter((n) => n.toLowerCase().endsWith(".xlsx") && !n.startsWith("~$") && pred(n.toUpperCase()))
    .sort();
  return encontrados[0] ? path.join(DIR, encontrados[0]) : undefined;
}

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`❌ No existe el directorio: ${DIR}`);
    process.exit(1);
  }
  console.log(`🛒 Compras · leyendo de ${DIR}`);

  // --- 1) Catálogo de tipos de proveedor (opcional) ---
  // Va primero porque el filtro "TIPO DE COMPRA" del informe se apoya en él;
  // sin el archivo, todos los proveedores salen como SIN CLASIFICAR.
  if (hacer("tipos")) {
    // La hoja "TIPOS DE PROVEEDORES" viene dentro de TABLAS AUXILIARES.xlsx
    // (el mismo libro del catálogo de bodegas); el parser la encuentra por
    // sus columnas, así que basta con dar con el archivo.
    const ruta = buscar((n) => n.includes("TIPOS DE PROVEEDOR") || n.includes("TABLAS AUXILIARES"));
    if (!ruta) {
      console.log("   · sin TABLAS AUXILIARES / TIPOS DE PROVEEDORES (el filtro por tipo de compra queda vacío)");
    } else {
      const lista = parseTiposProveedor(fs.readFileSync(ruta));
      await persistirTiposProveedor(lista);
      const tipos = [...new Set(lista.map((p) => p.tipoCompra))].filter(Boolean);
      console.log(`   ✓ ${path.basename(ruta)} → ${lista.length} proveedores · tipos: ${tipos.join(", ")}`);
    }
  }

  // --- 2) Órdenes de compra ---
  if (hacer("ordenes")) {
    const ruta = buscar((n) => n.includes("ORDENES DE COMPRA") || n.includes("ÓRDENES DE COMPRA"));
    if (!ruta) {
      console.log("   · sin archivo de ORDENES DE COMPRA");
    } else {
      const p = parseOrdenes(fs.readFileSync(ruta));
      const cargadas = await persistirOrdenes(p);
      const total = p.datos.reduce((a, d) => a + Number(d.valorNeto), 0);
      const ordenes = new Set(p.datos.map((d) => d.nroOrden)).size;
      console.log(`   ✓ ${path.basename(ruta)} [${p.hoja}] → ${fmt(cargadas)} renglones de ${fmt(p.filas)} · ${fmt(ordenes)} órdenes · ${cop(total)}`);
      console.log(`     periodos reemplazados: ${p.periodos.join(", ")}`);
      if (p.omitidas) console.log(`     ! ${fmt(p.omitidas)} renglones sin fecha de orden (omitidos)`);
    }
  }

  // --- 3) Pendientes por despacho (foto: reemplaza todo) ---
  if (hacer("pendientes")) {
    const ruta = buscar((n) => n.includes("PENDIENTES POR DESPACHO"));
    if (!ruta) {
      console.log("   · sin archivo de PENDIENTES POR DESPACHO");
    } else {
      const p = parsePendientesDespacho(fs.readFileSync(ruta));
      const cargadas = await persistirPendientesDespacho(p);
      const total = p.datos.reduce((a, d) => a + Number(d.valorPendiente), 0);
      const ordenes = new Set(p.datos.map((d) => d.nroOrden)).size;
      console.log(`   ✓ ${path.basename(ruta)} [${p.hoja}] → ${fmt(cargadas)} renglones · ${fmt(ordenes)} órdenes pendientes · ${cop(total)}`);
      if (p.omitidas) console.log(`     ! ${fmt(p.omitidas)} renglones sin fecha (omitidos)`);
    }
  }

  // --- 4) Facturado por proveedor ---
  if (hacer("facturas")) {
    const ruta = buscar((n) => n.includes("FACTURAS PROVEEDOR") || n.includes("FACTURADO PROVEEDOR"));
    if (!ruta) {
      console.log("   · sin archivo de FACTURAS PROVEEDORES");
    } else {
      const p = parseFacturasProveedor(fs.readFileSync(ruta));
      const cargadas = await persistirFacturasProveedor(p);
      const total = p.datos.reduce((a, d) => a + Number(d.valorNeto), 0);
      console.log(`   ✓ ${path.basename(ruta)} [${p.hoja}] → ${fmt(cargadas)} documentos de ${fmt(p.filas)} · ${cop(total)}`);
      console.log(`     periodos reemplazados: ${p.periodos.join(", ")}`);
      if (p.omitidas) console.log(`     ! ${fmt(p.omitidas)} filas sin fecha o repetidas (omitidas)`);
    }
  }

  console.log("✅ Listo.");
}

main()
  .catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
