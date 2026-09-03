import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nivelDe, nivelMejora } from "./capacitaciones";

// El detalle califica CUÁNTO SUBIÓ cada colaborador, no qué tan alto quedó.
// Los cuatro casos son los del informe de Gestión Humana, y el que se olvida
// siempre es el cuarto: subir algo pero menos de 10 puntos NO cumple.
describe("nivelMejora (columna Nivel del detalle)", () => {
  it("más de 10 puntos cumple", () => {
    assert.equal(nivelMejora(10.1).label, "Cumple");
    assert.equal(nivelMejora(60).label, "Cumple");
  });
  it("exactamente 10 puntos todavía NO cumple", () => {
    assert.equal(nivelMejora(10).label, "No cumple");
  });
  it("subir poco no cumple", () => {
    assert.equal(nivelMejora(0.5).label, "No cumple");
    assert.equal(nivelMejora(9.9).label, "No cumple");
  });
  it("quedarse igual es 'se mantuvo'", () => {
    assert.equal(nivelMejora(0).label, "Se mantuvo");
    assert.equal(nivelMejora(0).clase, "t-w1");
  });
  it("bajar es retroceso", () => {
    assert.equal(nivelMejora(-0.1).label, "Retrocedió");
    assert.equal(nivelMejora(-30).label, "Retrocedió");
  });
});

// El anillo de distribución sigue midiendo el DESEMPEÑO (% final), que es otra
// pregunta: 100 → 100 es desempeño excelente y mejora cero.
describe("nivelDe (distribución de desempeño)", () => {
  it("cortes de los cuatro niveles", () => {
    assert.equal(nivelDe(100).label, "Excelente");
    assert.equal(nivelDe(90).label, "Excelente");
    assert.equal(nivelDe(89.9).label, "Bueno");
    assert.equal(nivelDe(75).label, "Bueno");
    assert.equal(nivelDe(74.9).label, "Aceptable");
    assert.equal(nivelDe(60).label, "Aceptable");
    assert.equal(nivelDe(59.9).label, "Crítico");
    assert.equal(nivelDe(0).label, "Crítico");
  });
});
