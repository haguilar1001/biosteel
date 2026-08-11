import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { limpiarMonto, parseFechaDia, splitNitNombre, detectarTipo, parsearArchivo } from "./importar-siesa";

// Construye un buffer .xlsx a partir de una matriz de celdas.
function libro(aoa: (string | number)[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("limpiarMonto", () => {
  it("limpia formato con $ y comas", () => assert.equal(limpiarMonto("$1,716,357.00"), 1716357));
  it("acepta números crudos como texto", () => assert.equal(limpiarMonto("32891057.75"), 32891057.75));
  it("acepta number", () => assert.equal(limpiarMonto(30000000), 30000000));
  it("vacío/invalid → null", () => {
    assert.equal(limpiarMonto(""), null);
    assert.equal(limpiarMonto("abc"), null);
    assert.equal(limpiarMonto(null), null);
  });
});

describe("parseFechaDia (día-primero)", () => {
  it("DD/MM/AAAA", () => {
    const d = parseFechaDia("17/04/2026")!;
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 3); // abril
    assert.equal(d.getDate(), 17);
  });
  it("D/MM/AAAA (6 de enero, no junio)", () => {
    const d = parseFechaDia("6/01/2026")!;
    assert.equal(d.getMonth(), 0);
    assert.equal(d.getDate(), 6);
  });
  it("con hora se queda con la fecha", () => {
    const d = parseFechaDia("12/03/2026 0:00")!;
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 12);
  });
  it("fecha inválida → null", () => {
    assert.equal(parseFechaDia("32/13/2026"), null);
    assert.equal(parseFechaDia(""), null);
  });
});

describe("splitNitNombre", () => {
  it("separa NIT y nombre", () => {
    assert.deepEqual(splitNitNombre("900600550 - INVERSIONES MEDICAS BARU SAS"), { nit: "900600550", nombre: "INVERSIONES MEDICAS BARU SAS" });
  });
  it("sin guion → solo nombre", () => {
    assert.deepEqual(splitNitNombre("CLIENTE SIN NIT"), { nit: null, nombre: "CLIENTE SIN NIT" });
  });
});

// --- OCC/NGC/NBA (layout PCGA pivoteado) ---
const HEADER_PCGA = ["C.O.", "Documento", "Fecha", "Debito PCGA", "Credito PCGA", "Notas", "Estado", "Usuario anulacion"];
const occAoa = [
  HEADER_PCGA,
  ["Gran total", "", "", "1000", "1000", "", "", ""],
  ["CLIENTE A", "", "", "600", "600", "", "", ""],
  ["001", "OCC-00000001", "17/04/2026", "600", "600", "PRESTAMO RECIBIDO", "Aprobado", ""],
  ["CLIENTE B", "", "", "400", "400", "", "", ""],
  ["001", "OCC-00000002", "6/01/2026", "400", "400", "APLICACIÓN PAGO", "Aprobado", ""],
  ["001", "OCC-00000003", "5/02/2026", "100", "100", "ANULADO", "Aprobado", "gustavo.rodriguez"],
];

describe("parsearArchivo · OCC (PCGA ingreso)", () => {
  const r = parsearArchivo(libro(occAoa));
  it("detecta tipo y dirección", () => { assert.equal(r.tipo, "OCC"); assert.equal(r.direccion, "ingreso"); });
  it("cuenta detalle y omite anulados", () => { assert.equal(r.totalDetalle, 3); assert.equal(r.omitidos, 1); assert.equal(r.movimientos.length, 2); });
  it("suma correcta y sin errores", () => {
    assert.equal(r.movimientos.reduce((s, m) => s + m.valor, 0), 1000);
    assert.equal(r.errores.length, 0);
  });
  it("propaga el tercero del encabezado", () => {
    assert.equal(r.movimientos[0]!.terceroNombre, "CLIENTE A");
    assert.equal(r.movimientos[1]!.terceroNombre, "CLIENTE B");
  });
  it("detectarTipo directo", () => assert.equal(detectarTipo(occAoa), "OCC"));
});

describe("parsearArchivo · tipo forzado NGC (egreso)", () => {
  const ngcAoa = [HEADER_PCGA, ["PROVEEDOR X", "", "", "500", "500", "", "", ""], ["001", "NGC-00000001", "1/06/2026", "500", "500", "PAGO NOMINA", "Aprobado", ""]];
  const r = parsearArchivo(libro(ngcAoa), "NGC");
  it("respeta el tipo forzado y su dirección", () => { assert.equal(r.tipo, "NGC"); assert.equal(r.direccion, "egreso"); });
  it("un movimiento válido", () => { assert.equal(r.movimientos.length, 1); assert.equal(r.movimientos[0]!.valor, 500); });
});

// --- PEL ---
describe("parsearArchivo · PEL (egreso, plano)", () => {
  const aoa = [
    ["Descripción cuenta ", "C.O.", "Documento", "Fecha docto.", "Valor docto.", "Tipo comprobante", "Razón social tercero", "Beneficiario", "Descripción banco", "Estado documento", "Estado impresión", "Notas"],
    ["BANCO SERFINANZA", "001", "PEL-00008354", "12/03/2026 0:00", "30000000", "Pago electrónico", "STRYKER COLOMBIA S.A.S", "STRYKER COLOMBIA S.A.S", "BANCOLOMBIA", "Aprobado", "Por imprimir", "PAGO FACTURAS DE PROVEEDOR"],
    ["BANCO SERFINANZA", "001", "PEL-00008355", "20/04/2026 0:00", "1000000", "Pago electrónico", "TERCERO Y", "TERCERO Y", "BOGOTA", "Anulado", "Por imprimir", "X"],
  ];
  const r = parsearArchivo(libro(aoa));
  it("detecta PEL egreso", () => { assert.equal(r.tipo, "PEL"); assert.equal(r.direccion, "egreso"); });
  it("omite el no-aprobado y toma beneficiario", () => {
    assert.equal(r.movimientos.length, 1);
    assert.equal(r.omitidos, 1);
    assert.equal(r.movimientos[0]!.beneficiario, "STRYKER COLOMBIA S.A.S");
    assert.equal(r.movimientos[0]!.valor, 30000000);
  });
});

// --- RDC ---
describe("parsearArchivo · RDC (recaudos, ingreso)", () => {
  const aoa = [
    ["", "", "", "", "", "RELACION DE RECAUDOS", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "[", "CONSIGNACIONES BANCOLOMBIA", "", "]", "", "", "", "", "", ""],
    ["Documento", "", "Fecha", "C.O", "Cliente", "Caja", "Cobrador", "Cta Bancaria", "F. Cons.", "", "Valor", "", "", ""],
    ["RDC-00003777", "", "14/01/2026", "001", "900600550 - INVERSIONES MEDICAS BARU SAS", "001", "01", "002", "14/01/2026", "", "20000000", "", "", ""],
    ["", "", "", "", "", "Total CONSIGNACIONES", "", "", "", "", "20000000", "", "", ""],
  ];
  const r = parsearArchivo(libro(aoa));
  it("detecta RDC ingreso", () => { assert.equal(r.tipo, "RDC"); assert.equal(r.direccion, "ingreso"); });
  it("un recaudo, separa NIT y guarda el medio en el detalle", () => {
    assert.equal(r.movimientos.length, 1);
    const m = r.movimientos[0]!;
    assert.equal(m.nit, "900600550");
    assert.equal(m.terceroNombre, "INVERSIONES MEDICAS BARU SAS");
    assert.equal(m.valor, 20000000);
    assert.match(m.detalle ?? "", /CONSIGNACIONES BANCOLOMBIA/);
  });
});

describe("parsearArchivo · errores", () => {
  it("reporta fila con valor inválido", () => {
    const aoa = [HEADER_PCGA, ["CLIENTE A", "", "", "", "", "", "", ""], ["001", "OCC-00000009", "17/04/2026", "", "", "X", "Aprobado", ""]];
    const r = parsearArchivo(libro(aoa));
    assert.equal(r.movimientos.length, 0);
    assert.equal(r.errores.length, 1);
    assert.match(r.errores[0]!.motivo, /[Vv]alor/);
  });
});
