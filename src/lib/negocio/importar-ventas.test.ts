import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { limpiarMonto, parseFechaMDY } from "./importar-ventas";

describe("limpiarMonto (ventas)", () => {
  it("limpia formato con $ y separadores", () => {
    assert.equal(limpiarMonto("$1,716,357.00"), 1716357);
    assert.equal(limpiarMonto("2565530"), 2565530);
  });
  it("acepta number y valores vacíos", () => {
    assert.equal(limpiarMonto(214706), 214706);
    assert.equal(limpiarMonto(""), 0);
    assert.equal(limpiarMonto(null), 0);
    assert.equal(limpiarMonto("abc"), 0);
  });
  it("paréntesis = negativo", () => assert.equal(limpiarMonto("(1500)"), -1500));

  // El libro se lee con raw:false, así que una celda con formato de porcentaje
  // llega como texto "200%" aunque su valor real sea 2. Sin esta regla la
  // cantidad se multiplica por cien: es lo que infló las unidades de 2026.
  describe("celdas con formato de porcentaje", () => {
    it("1 unidad formateada como porcentaje", () => assert.equal(limpiarMonto("100%"), 1));
    it("2 unidades", () => assert.equal(limpiarMonto("200%"), 2));
    it("4 unidades", () => assert.equal(limpiarMonto("400%"), 4));
    it("con separador de miles", () => assert.equal(limpiarMonto("1,500%"), 15));
    it("no toca las celdas normales", () => assert.equal(limpiarMonto("200"), 200));
  });
});

describe("parseFechaMDY", () => {
  it("lee M/D/AA americano", () => {
    assert.deepEqual(parseFechaMDY("8/11/26"), { ms: Date.UTC(2026, 7, 11), anio: 2026, mes: 8 });
  });
  it("rechaza basura", () => assert.equal(parseFechaMDY("no es fecha"), null));
});
