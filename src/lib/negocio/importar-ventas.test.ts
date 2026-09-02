import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { limpiarMonto, parseFechaMDY, cantidadesSospechosas } from "./importar-ventas";

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

describe("cantidadesSospechosas (columna Cantidad ×100)", () => {
  const cant = (ns: number[]) => ns.map((cantidad) => ({ cantidad }));
  // Un archivo real: unidades sueltas, casi nunca redondas.
  const normal = cant([1, 2, 1, 6, 3, 14, 2, 1, 1, 4, 8, 2, 1, 5, 1, 2, 3, 1, 1, 2, 100, 200]);
  // Uno con la columna inflada: TODO múltiplo de 100.
  const inflado = cant([100, 200, 100, 600, 300, 1400, 200, 100, 100, 400, 800, 200,
    100, 500, 100, 200, 300, 100, 100, 200, 100, 300]);

  it("un archivo normal pasa", () => assert.equal(cantidadesSospechosas(normal), null));
  it("un archivo inflado se detiene", () => {
    const r = cantidadesSospechosas(inflado);
    assert.ok(r);
    assert.equal(r.conCantidad, 22);
    assert.equal(r.multiplos, 22);
  });
  it("los ceros no cuentan", () => assert.equal(cantidadesSospechosas(cant([0, 0, 0, 100, 200])), null));
  it("pocos renglones no alcanzan para acusar", () =>
    assert.equal(cantidadesSospechosas(cant([100, 200, 300])), null));
  it("una minoría redonda no basta", () =>
    assert.equal(cantidadesSospechosas(cant([...Array(19).fill(1), 100, 200, 300])), null));
});

describe("parseFechaMDY", () => {
  it("lee M/D/AA americano", () => {
    assert.deepEqual(parseFechaMDY("8/11/26"), { ms: Date.UTC(2026, 7, 11), anio: 2026, mes: 8 });
  });
  it("rechaza basura", () => assert.equal(parseFechaMDY("no es fecha"), null));
});
