import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCOP, formatNumero, formatPorcentaje, formatFecha, formatFechaHora } from "./format";

describe("formato numérico (es-CO)", () => {
  it("pesos sin decimales, miles con punto", () => {
    assert.equal(formatCOP(1234567), "$ 1.234.567");
    assert.equal(formatCOP("1716357.00"), "$ 1.716.357");
    assert.equal(formatCOP(1234567.89), "$ 1.234.568"); // redondea
  });
  it("número entero con separador de miles", () => {
    assert.equal(formatNumero(1621), "1.621");
    assert.equal(formatNumero(12698162412), "12.698.162.412");
  });
  it("porcentaje con dos decimales", () => {
    assert.equal(formatPorcentaje(45.5), "45,50 %");
    assert.equal(formatPorcentaje(0.455, true), "45,50 %"); // proporción
  });
});

describe("formato de fechas (DD/MM/AAAA)", () => {
  it("formatFecha", () => assert.equal(formatFecha(new Date(2026, 7, 13)), "13/08/2026"));
  it("formatFecha rellena con ceros", () => assert.equal(formatFecha(new Date(2026, 0, 6)), "06/01/2026"));
  it("formatFechaHora", () => assert.equal(formatFechaHora(new Date(2026, 3, 20, 15, 29)), "20/04/2026 15:29"));
});
