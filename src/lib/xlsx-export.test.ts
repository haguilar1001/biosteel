import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { libroDescarga } from "./xlsx-export";

describe("libroDescarga", () => {
  it("genera un xlsx descargable y con los datos correctos", async () => {
    const res = libroDescarga({
      hoja: "Hoja",
      encabezado: ["Nombre", "Valor"],
      filas: [["Ana", 100], ["Beto", 200], ["", 300]],
      archivo: "reporte.xlsx",
      anchos: [20, 12],
    });

    assert.equal(res.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.match(res.headers.get("content-disposition") ?? "", /reporte\.xlsx/);

    const buf = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets["Hoja"]!, { header: 1 });
    assert.deepEqual(rows[0], ["Nombre", "Valor"]);
    assert.deepEqual(rows[1], ["Ana", 100]);
    assert.equal(rows[3]?.[1], 300);
  });
});
