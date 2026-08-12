// Pruebas del motor de Notas Crédito (casos representativos del docx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ipsDe, aplicaNota, notaCredito, nroClave, type VentaRow, type CtxNC, type ParamNC } from "./nota-credito";

const D = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

// Parámetros de ejemplo (vigencia nov-2025 → abr-2026).
const params: ParamNC[] = [
  { ips: "CAMPBELL", concepto: "BRACE", pct: 0.25, ini: D(2025, 11, 1), fin: D(2026, 4, 30) },
  { ips: "CAMPBELL", concepto: "ALTO_COSTO", pct: 0.12, ini: D(2025, 11, 1), fin: D(2026, 4, 30) },
  { ips: "CAMPBELL", concepto: "MOS", pct: 0.45, ini: D(2025, 11, 1), fin: D(2026, 4, 30) },
  { ips: "VALLE", concepto: "MOS", pct: 0.4, ini: D(2025, 11, 1), fin: D(2026, 4, 30) },
];

const ctx: CtxNC = { params, nanMeses: new Map(), excluidos: new Set() };

function fila(over: Partial<VentaRow>): VentaRow {
  return {
    nro: "FET-1", tipo: "FET", aprobada: true, ms: D(2026, 1, 15), anio: 2026, mes: 1,
    ips: "CAMPBELL", suc: "", bod: "", notas: "", conv: "", proc: "", linea: "2002 - TRAUMA/ORTOPEDIA",
    subtotal: 1_000_000, ...over,
  };
}

test("ipsDe reconoce keywords y alias", () => {
  assert.equal(ipsDe("CLINICA CAMPBELL SAS"), "CAMPBELL");
  assert.equal(ipsDe("SERVISALUD DEL VALLE"), "VALLE");
  assert.equal(ipsDe("URGETRAUMA IPS"), "VALLE");
  assert.equal(ipsDe("CM BAHIA"), "CM BAHIA");
  assert.equal(ipsDe("OTRO CLIENTE"), null);
});

test("BRACE: descuento por sucursal BRAC", () => {
  const r = fila({ suc: "MALAMBO BRACE", ips: "CAMPBELL" });
  assert.equal(notaCredito(r, ctx), 250_000); // 1M * 0.25
});

test("MOS: catch-all cuando no hay otros subdescuentos", () => {
  const r = fila({ ips: "CAMPBELL", suc: "CLINICA X" });
  assert.equal(notaCredito(r, ctx), 450_000); // 1M * 0.45
});

test("No FET ⇒ 0", () => {
  assert.equal(notaCredito(fila({ tipo: "NAN" }), ctx), 0);
});

test("Estado no Aprobada ⇒ 0 (no aplica)", () => {
  assert.equal(notaCredito(fila({ aprobada: false }), ctx), 0);
});

test("CAMPBELL con convenio COOSALUD ⇒ no aplica", () => {
  const r = fila({ ips: "CAMPBELL", conv: "COOSALUD CAPITA", suc: "CLINICA X" });
  assert.equal(aplicaNota(r), false);
  assert.equal(notaCredito(r, ctx), 0);
});

test("NAN de otro mes anula el descuento", () => {
  const c: CtxNC = { params, nanMeses: new Map([["FET-9", new Set(["2026-3"])]]), excluidos: new Set() };
  const r = fila({ nro: "FET-9", ips: "CAMPBELL", suc: "CLINICA X", mes: 1, ms: D(2026, 1, 15) });
  assert.equal(notaCredito(r, c), 0);
});

test("Exclusión manual ⇒ 0 (compara por núcleo numérico)", () => {
  // La exclusión se guarda como número pelado; el motor la normaliza.
  const c: CtxNC = { params, nanMeses: new Map(), excluidos: new Set(["119966"]) };
  const r = fila({ nro: "FET-00119966", ips: "CAMPBELL", suc: "CLINICA X" });
  assert.equal(notaCredito(r, c), 0);
});

test("nroClave normaliza prefijo y ceros", () => {
  assert.equal(nroClave("FET-00119966"), "119966");
  assert.equal(nroClave("119966"), "119966");
});
