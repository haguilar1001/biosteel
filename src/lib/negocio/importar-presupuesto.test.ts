import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parsePresupuesto } from "./importar-presupuesto";

/** Arma un buffer .xlsx con la hoja Presupuesto_Terceros a partir de filas AOA. */
function libro(filas: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto_Terceros");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parsePresupuesto — encabezados de mes", () => {
  it("reconoce las abreviaturas de 3 letras (ENE..DIC)", () => {
    const buf = libro([
      ["GRUPO", "TERCERO", "ENE", "AGO"],
      ["Servicios", "Proveedor X", 100, 200],
    ]);
    const p = parsePresupuesto(buf);
    assert.deepEqual(p.meses, [1, 8]);
    assert.equal(p.columnasIgnoradas.length, 0);
  });

  // Caso real: el archivo de Financiero llevaba ENE..AGO abreviado y la
  // columna nueva se escribió "SEPTIEMBRE" completo. El mes se cargaba en
  // cero sin ningún aviso — septiembre desaparecía del presupuesto.
  it("reconoce el nombre completo del mes aunque las demás columnas vayan abreviadas", () => {
    const buf = libro([
      ["GRUPO", "TERCERO", "AGO", "SEPTIEMBRE"],
      ["Servicios", "Proveedor X", 200, 300],
    ]);
    const p = parsePresupuesto(buf);
    assert.deepEqual(p.meses, [8, 9]);
    assert.equal(p.filas.find((f) => f.mes === 9)?.valor, 300);
    assert.equal(p.columnasIgnoradas.length, 0);
  });

  it("no distingue mayúsculas/tildes en el nombre completo", () => {
    const buf = libro([
      ["Grupo", "Tercero", "Septiembre"],
      ["Servicios", "Proveedor X", 150],
    ]);
    const p = parsePresupuesto(buf);
    assert.deepEqual(p.meses, [9]);
  });

  it("reporta una columna con datos que no es GRUPO/TERCERO ni un mes reconocido", () => {
    const buf = libro([
      ["GRUPO", "TERCERO", "ENE", "OBSERVACIONES"],
      ["Servicios", "Proveedor X", 100, "nota"],
    ]);
    const p = parsePresupuesto(buf);
    assert.deepEqual(p.columnasIgnoradas, ["OBSERVACIONES"]);
  });
});
