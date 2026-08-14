"use client";
// ==========================================================
// Carga de reportes SIESA: seleccionar archivo → Previsualizar (dry-run)
// → Confirmar. La confirmación reenvía el MISMO archivo (idempotente).
// ==========================================================
import { useActionState } from "react";
import { importarSiesaAction, type ImportState } from "./actions";

const cop = (n: number) => `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n))}`;

const TIPOS = [
  { v: "auto", l: "Detectar automáticamente" },
  { v: "OCC", l: "OCC · Ingresos" },
  { v: "RDC", l: "RDC · Recaudos de cartera" },
  { v: "NGC", l: "NGC · Egresos (pagos)" },
  { v: "NBA", l: "NBA · Egresos bancarios" },
  { v: "PEL", l: "PEL · Pagos electrónicos" },
];

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" | "warn" | "blue" }) {
  const color = tone === "ok" ? "var(--ok, #2A9D6B)" : tone === "bad" ? "var(--bad, #D64545)" : tone === "warn" ? "#a97b00" : tone === "blue" ? "var(--azul, #2A4F98)" : "inherit";
  return (
    <div className="kpi" style={{ minWidth: 130 }}>
      <div className="klabel">{label}</div>
      <div className="kval num" style={{ color }}>{value}</div>
    </div>
  );
}

export default function ImportadorForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importarSiesaAction, {});
  const r = state.resumen;
  const hayPreview = state.ok && state.modo === "preview" && !!r;
  const commiteado = state.ok && state.modo === "commit";
  const puedeConfirmar = hayPreview && r!.nuevos > 0;
  const esIngreso = state.direccion === "ingreso";

  return (
    <div className="card">
      <div className="chart-head">
        Importar desde SIESA
        <span className="hact">OCC · NGC · NBA · PEL · Recaudos</span>
      </div>

      <div className="card-body">
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          Sube un reporte exportado de SIESA (.xls / .xlsx). <b>Previsualiza</b> para revisar
          qué se cargará (los ya importados se omiten por número de documento) y luego
          <b> confirma</b>. Ingresos = OCC + Recaudos · Egresos = NGC + NBA + PEL.
        </p>

        <form action={action}>
          <div className="toolbar" style={{ alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div className="field">
              <label>Archivo</label>
              <input type="file" name="file" accept=".xls,.xlsx,.xlsm" required className="select" />
            </div>
            <div className="field">
              <label>Tipo de reporte</label>
              <select name="tipo" defaultValue="auto" className="select">
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <button type="submit" name="intent" value="preview" className="btn primary" disabled={pending}>
              {pending ? "Procesando…" : "🔍 Previsualizar"}
            </button>
            {puedeConfirmar && (
              <button type="submit" name="intent" value="commit" className="btn" disabled={pending}
                      style={{ borderColor: "var(--ok, #2A9D6B)", color: "var(--ok, #2A9D6B)", fontWeight: 700 }}>
                ✅ Confirmar importación
              </button>
            )}
          </div>
        </form>

        {state.error && <p className="alert" style={{ color: "var(--bad)" }}>⚠️ {state.error}</p>}

        {commiteado && (
          <p className="alert" style={{ color: "var(--ok, #2A9D6B)", fontWeight: 600 }}>
            ✅ Importación completa: {state.insertados} movimiento(s) cargados como <b>{esIngreso ? "ingresos" : "egresos"}</b>.{" "}
            <a href={esIngreso ? "/flujo/ingresos" : "/flujo/egresos"}>Ver {esIngreso ? "ingresos" : "egresos"} →</a>
          </p>
        )}

        {r && (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "14px 0 8px" }}>
              <span className={`tag ${esIngreso ? "t-ok" : "t-bad"}`}>{state.etiqueta}</span>
              <span className="tag t-blue">{esIngreso ? "INGRESO" : "EGRESO"}</span>
              {commiteado ? <span className="flag">— resultado de la carga</span> : <span className="flag">— vista previa (aún no se guarda)</span>}
            </div>

            <div className="kpis" style={{ marginBottom: 8 }}>
              <Stat label={commiteado ? "Cargados" : "Nuevos a cargar"} value={String(commiteado ? (state.insertados ?? 0) : r.nuevos)} tone="ok" />
              <Stat label="Ya existían" value={String(r.duplicados)} tone="blue" />
              <Stat label="Con error" value={String(r.errores)} tone={r.errores ? "bad" : undefined} />
              <Stat label="Omitidos (anulados)" value={String(r.omitidos)} tone={r.omitidos ? "warn" : undefined} />
              <Stat label="Suma nuevos" value={cop(r.sumaNuevos)} tone="ok" />
            </div>
            {r.rango && <p className="flag" style={{ margin: "0 0 8px" }}>📅 Rango de fechas: {r.rango.min} — {r.rango.max}{r.hojasIgnoradas > 0 ? ` · ⚠️ ${r.hojasIgnoradas} hoja(s) extra del libro no procesada(s)` : ""}</p>}

            {state.duplicados && state.duplicados.length > 0 && (
              <p className="flag" style={{ margin: "0 0 8px" }}>
                Omitidos por ya existir: {state.duplicados.join(", ")}{r.duplicados > state.duplicados.length ? ` … (+${r.duplicados - state.duplicados.length})` : ""}
              </p>
            )}

            {/* Clasificación automática por categoría */}
            {state.porCategoria && state.porCategoria.length > 0 && (
              <>
                <div className="subhead" style={{ margin: "6px 0" }}>Clasificación automática por categoría</div>
                <div className="tbl-wrap" style={{ marginBottom: 12 }}>
                  <table data-noorden className="tabla-fit">
                    <thead><tr><th>Categoría</th><th className="r" style={{ width: 120 }}>Movimientos</th><th className="r" style={{ width: 160 }}>Suma</th></tr></thead>
                    <tbody>
                      {state.porCategoria.map((c) => (
                        <tr key={c.categoria}>
                          <td style={{ fontWeight: 600 }}>{c.categoria}</td>
                          <td className="r num">{c.cantidad}</td>
                          <td className="r num" style={{ fontWeight: 700 }}>{cop(c.suma)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Errores */}
            {state.erroresLista && state.erroresLista.length > 0 && (
              <div className="tbl-wrap" style={{ marginBottom: 12 }}>
                <table data-noorden className="tabla-fit">
                  <thead><tr><th style={{ width: 80 }}>Fila</th><th style={{ width: 160 }}>Documento</th><th>Motivo</th></tr></thead>
                  <tbody>
                    {state.erroresLista.map((e, i) => (
                      <tr key={i}><td className="num flag">{e.fila}</td><td className="flag">{e.documento ?? "—"}</td><td style={{ color: "var(--bad)" }}>{e.motivo}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Muestra de los nuevos */}
            {state.muestra && state.muestra.length > 0 && (
              <>
                <div className="subhead" style={{ margin: "6px 0" }}>
                  {commiteado ? "Movimientos cargados" : "Vista previa"} (primeros {state.muestra.length} de {r.nuevos})
                </div>
                <div className="tbl-wrap">
                  <table data-noorden className="tabla-fit">
                    <thead>
                      <tr><th style={{ width: 130 }}>Documento</th><th style={{ width: 100 }}>Fecha</th><th>Tercero</th><th style={{ width: 110 }}>NIT</th><th>Detalle</th><th style={{ width: 150 }}>Categoría</th><th className="r" style={{ width: 140 }}>Valor</th></tr>
                    </thead>
                    <tbody>
                      {state.muestra.map((m) => (
                        <tr key={m.documento}>
                          <td className="flag">{m.documento}</td>
                          <td className="flag">{m.fecha}</td>
                          <td style={{ fontWeight: 600 }} title={m.terceroNombre}>{m.terceroNombre}</td>
                          <td className="flag">{m.nit ?? "—"}</td>
                          <td className="flag" title={m.detalle ?? ""}>{m.detalle ?? "—"}</td>
                          <td><span className="tag t-blue">{m.categoria}</span></td>
                          <td className="r num" style={{ fontWeight: 700, color: esIngreso ? "var(--ingreso, #2A9D6B)" : "var(--bad, #D64545)" }}>{cop(m.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {hayPreview && r.nuevos === 0 && r.errores === 0 && (
              <p className="flag" style={{ marginTop: 8 }}>Todo en este archivo ya estaba importado. Nada por cargar.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
