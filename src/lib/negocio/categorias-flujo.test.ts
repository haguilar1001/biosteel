import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clasificar, normalizar, CATEGORIAS_FLUJO } from "./categorias-flujo";

describe("normalizar", () => {
  it("pasa a mayúsculas y quita tildes", () => {
    assert.equal(normalizar("Nómina"), "NOMINA");
    assert.equal(normalizar("pólizá"), "POLIZA");
    assert.equal(normalizar("aplicación"), "APLICACION");
  });
});

describe("clasificar · egresos", () => {
  const casos: [string, string][] = [
    ["PAGO NOMINA MES DE JULIO", "Nómina y prestaciones"],
    ["PAGO PRIMAS DE SERVICIOS", "Nómina y prestaciones"],
    ["PAGO FACTURAS DE PROVEEDOR", "Proveedores"],
    ["PAGO ANTICIPO A PROVEEDOR", "Proveedores"],
    ["PAGO ABONO PROVEEDOR", "Proveedores"],
    ["INTERESES CORRIENTES", "Financieros y bancarios"],
    ["GASTOS BANCARIOS", "Financieros y bancarios"],
    ["DÉBITO PRÉSTAMO CUOTA 3", "Financieros y bancarios"],
    ["DEBITO EMBARGO JUZGADO 2", "Embargos y jurídicos"],
    ["PAGO POLIZA TODO RIESGO", "Seguros y pólizas"],
    ["PAGO SERVICIO DE ENERGIA", "Servicios y arriendos"],
    ["PAGO MANTENIMIENTO CAMIONETA", "Servicios y arriendos"],
    ["PAGO IMPUESTO PREDIAL", "Impuestos"],
    ["RETENCION EN LA FUENTE DIAN", "Impuestos"],
    ["ALGO QUE NO EXISTE", "Otros egresos"],
  ];
  for (const [texto, esperado] of casos) {
    it(`"${texto}" → ${esperado}`, () => assert.equal(clasificar(texto, "egreso"), esperado));
  }

  it("prioriza Impuestos sobre Financieros cuando aparece DIAN", () => {
    assert.equal(clasificar("PAGO INTERESES DE MORA DIAN", "egreso"), "Impuestos");
  });
});

describe("clasificar · ingresos", () => {
  const casos: [string, string][] = [
    ["APLICACIÓN PAGO CLINICA", "Recaudo de cartera"],
    ["APLIACIÓN PAGO (con typo del ERP)", "Recaudo de cartera"],
    ["ABONO A CARTERA", "Recaudo de cartera"],
    ["RDC-00003777 · CONSIGNACIONES BANCOLOMBIA", "Recaudo de cartera"],
    ["PRESTAMO RECIBIDO PARA PAGO", "Financiación recibida"],
    ["DEV DE SALDO A FAVOR", "Devoluciones y reintegros"],
    ["INGRESO SIN PATRON", "Otros ingresos"],
  ];
  for (const [texto, esperado] of casos) {
    it(`"${texto}" → ${esperado}`, () => assert.equal(clasificar(texto, "ingreso"), esperado));
  }

  it("es robusto ante texto nulo/vacío", () => {
    assert.equal(clasificar(null, "ingreso"), "Otros ingresos");
    assert.equal(clasificar("", "egreso"), "Otros egresos");
  });
});

describe("catálogo", () => {
  it("toda categoría devuelta por el clasificador existe en el catálogo", () => {
    const nombres = new Set(CATEGORIAS_FLUJO.map((c) => c.nombre));
    const muestras = ["PAGO NOMINA", "APLICACIÓN PAGO", "PRESTAMO RECIBIDO", "XX", "DEV DE"];
    for (const t of muestras) {
      assert.ok(nombres.has(clasificar(t, "egreso")));
      assert.ok(nombres.has(clasificar(t, "ingreso")));
    }
  });
  it("nombres únicos", () => {
    assert.equal(new Set(CATEGORIAS_FLUJO.map((c) => c.nombre)).size, CATEGORIAS_FLUJO.length);
  });
});
