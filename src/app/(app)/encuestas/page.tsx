// ==========================================================
// Análisis · Encuestas de Satisfacción — mismo lenguaje visual que Asistencia
// Técnica (KPIs, BarraNota con meta, tablas con tags, tarjeta de resumen).
// Datos desde @/lib/negocio/datos-encuestas (por año). Meta institucional ≥ 4,5.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatNumero } from "@/lib/format";
import { FiltroAuto } from "../_components/FiltroAuto";
import { datosEncuestas } from "@/lib/negocio/datos-encuestas";
import { COMPONENTES, PREGUNTAS_INST } from "@/lib/encuestas/catalogo";

const META = 4.5;
const nota = (v: number) => v.toFixed(2).replace(".", ",");
const pct1 = (v: number) => (v * 100).toFixed(1).replace(".", ",") + " %";

function tono(v: number): string {
  if (v >= META + 0.3) return "var(--ok)";
  if (v >= META) return "var(--brand)";
  return "var(--bad)";
}
function tagNivel(v: number): string {
  if (v >= 4.5) return "t-ok";
  if (v >= 4.0) return "t-w1";
  return "t-bad";
}

/** Barra de una calificación en escala 1–5, con la meta marcada (como Asistencia). */
function BarraNota({ valor, ancho = 190 }: { valor: number; ancho?: number }) {
  const pos = (v: number) => ((v - 1) / 4) * 100;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ position: "relative", width: ancho, height: 8, background: "var(--brand-tint)", borderRadius: 4, overflow: "hidden", flex: "0 0 auto" }}>
        <span style={{ position: "absolute", inset: 0, width: `${pos(valor)}%`, background: tono(valor), borderRadius: 4 }} />
        <span style={{ position: "absolute", top: -2, bottom: -2, left: `${pos(META)}%`, width: 2, background: "var(--ink)", opacity: 0.55 }} title={`Meta ${nota(META)}`} />
      </span>
      <b className="num" style={{ color: tono(valor), minWidth: 34 }}>{nota(valor)}</b>
    </span>
  );
}

export default async function EncuestasPage({
  searchParams,
}: { searchParams: Promise<{ anio?: string; vista?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  const { anio, anios, vacio, data } = await datosEncuestas(sp.anio ? Number(sp.anio) : undefined);
  if (vacio || !data || anio == null) {
    return (
      <div className="card"><div className="card-body">
        <div className="empty">Sin encuestas cargadas. Súbelas en <b>Cargar archivos → Calidad</b> o corre <code>npm run db:encuestas</code>.</div>
      </div></div>
    );
  }

  const D = data;
  const vista: "inst" | "ortho" = sp.vista === "ortho" ? "ortho" : "inst";
  const base = `/encuestas?anio=${anio}`;

  // Derivados institucionales
  const best = D.records.length ? D.records.reduce((a, b) => (b.promedio > a.promedio ? b : a)) : undefined;
  const worst = D.records.length ? D.records.reduce((a, b) => (b.promedio < a.promedio ? b : a)) : undefined;
  const compBajo = D.components.length ? D.components.reduce((a, b) => (b.promedio < a.promedio ? b : a)) : undefined;
  const maxDist = Math.max(1, ...Object.values(D.overall.dist));
  const DIST = [
    { k: "5", label: "Calificación 5", color: "var(--ok)" },
    { k: "4", label: "Calificación 4", color: "var(--brand-2)" },
    { k: "3", label: "Calificación 3", color: "var(--w1)" },
    { k: "2", label: "Calificación 2", color: "var(--w2)" },
    { k: "1", label: "Calificación 1", color: "var(--bad)" },
  ];

  // Derivados ortopedistas
  const oBest = D.ortho.items.length ? D.ortho.items.reduce((a, b) => (b.val > a.val ? b : a)) : undefined;
  const oWorst = D.ortho.items.length ? D.ortho.items.reduce((a, b) => (b.val < a.val ? b : a)) : undefined;

  return (
    <>
      {/* Filtros + selector de vista */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 15 }}>Encuestas de Satisfacción · {anio}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {vista === "inst"
                ? <>Clientes institucionales · 19 criterios en 4 componentes · meta ≥ {nota(META)}</>
                : <>Especialistas (ortopedistas) · 14 criterios · formato FOR-GC-011 · meta ≥ {nota(META)}</>}
            </div>
          </div>
          <div className="toolbar" style={{ gap: 8 }}>
            <span role="group" aria-label="Encuesta" style={{ display: "inline-flex", gap: 4 }}>
              <a href={`${base}&vista=inst`} className={`btn ${vista === "inst" ? "primary" : ""}`}>Institucionales</a>
              <a href={`${base}&vista=ortho`} className={`btn ${vista === "ortho" ? "primary" : ""}`}>Ortopedistas</a>
            </span>
            <FiltroAuto className="toolbar">
              <input type="hidden" name="vista" value={vista} />
              <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
              <select name="anio" defaultValue={anio} className="select">
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </FiltroAuto>
          </div>
        </div>
      </div>

      {vista === "inst" ? (
        <>
          {/* KPIs institucionales */}
          <div className="kpis" style={{ marginBottom: 12 }}>
            <div className={`kpi kc ${D.overall.promedio >= META ? "k-ok" : "k-bad"}`}>
              <div className="klabel">Promedio general</div>
              <div className="kval num" style={{ color: tono(D.overall.promedio) }}>{nota(D.overall.promedio)}</div>
              <div className="ksub" style={{ color: D.overall.promedio >= META ? "var(--ok)" : "var(--bad)" }}>
                {D.overall.promedio >= META ? "✓ cumple" : "✗ no cumple"} la meta de {nota(META)}
              </div>
            </div>
            <div className="kpi kc">
              <div className="klabel">Encuestas / respuestas</div>
              <div className="kval num">{formatNumero(D.overall.total_encuestas)}</div>
              <div className="ksub" style={{ color: "var(--muted)" }}>{formatNumero(D.overall.total_respuestas)} respuestas</div>
            </div>
            <div className="kpi kc">
              <div className="klabel">Mejor encuesta</div>
              <div className="kval num" style={{ color: tono(best?.promedio ?? 0) }}>{nota(best?.promedio ?? 0)}</div>
              <div className="ksub" style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={best?.cliente}>{best?.cliente ?? "—"}</div>
            </div>
            <div className={`kpi kc ${compBajo && compBajo.promedio >= META ? "k-ok" : "k-bad"}`}>
              <div className="klabel">Componente a reforzar</div>
              <div className="kval num" style={{ fontSize: 20, color: tono(compBajo?.promedio ?? 0) }}>{nota(compBajo?.promedio ?? 0)}</div>
              <div className="ksub" style={{ color: "var(--muted)" }}>{compBajo?.nombre ?? "—"}</div>
            </div>
          </div>

          {/* Componentes + distribución */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", marginBottom: 12, alignItems: "start" }}>
            <div className="card">
              <div className="chart-head">Calificación por Componente <span className="hact">escala 1–5 · meta {nota(META)}</span></div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {D.components.map((c) => (
                  <div key={c.nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.nombre}</span>
                    <BarraNota valor={c.promedio} />
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="chart-head">Distribución de Calificaciones <span className="hact">{formatNumero(D.overall.total_respuestas)} respuestas</span></div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {DIST.map((d) => {
                  const v = D.overall.dist[d.k] ?? 0;
                  return (
                    <div key={d.k} style={{ display: "grid", gridTemplateColumns: "110px 1fr 96px", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                      <span style={{ position: "relative", height: 14, background: "var(--brand-tint)", borderRadius: 4, overflow: "hidden" }}>
                        <span style={{ position: "absolute", inset: 0, width: `${(v / maxDist) * 100}%`, background: d.color, borderRadius: 4 }} />
                      </span>
                      <span className="num flag" style={{ textAlign: "right" }}>{formatNumero(v)} · {D.overall.total_respuestas ? ((v / D.overall.total_respuestas) * 100).toFixed(1).replace(".", ",") : "0"} %</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Promedio por pregunta (agrupado por componente) */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="chart-head">Promedio por Pregunta / Ítem <span className="hact">19 criterios</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {COMPONENTES.map((comp) => (
                <div key={comp.clave} style={{ marginBottom: 4 }}>
                  <div className="subhead" style={{ margin: "6px 0 6px" }}>{comp.nombre}</div>
                  {PREGUNTAS_INST.filter((q) => q.comp === comp.clave).map((q) => {
                    const qc = D.questions.find((x) => x.codigo === q.codigo)!;
                    return (
                      <div key={q.codigo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "3px 0" }}>
                        <span style={{ fontSize: 12.5 }}><b className="flag">{q.codigo}</b> {q.pregunta}</span>
                        <BarraNota valor={qc.promedio} ancho={150} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Detalle por encuesta / cliente */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="chart-head">Calificación por Encuesta / Cliente <span className="hact">{formatNumero(D.records.length)} encuestas</span></div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr><th>N.º</th><th>Fecha</th><th>Cliente / referencia</th><th>Cargo</th><th>Calificación</th><th></th></tr>
                </thead>
                <tbody>
                  {[...D.records].sort((a, b) => b.promedio - a.promedio).map((r) => (
                    <tr key={r.encuesta}>
                      <td className="flag">{r.encuesta}</td>
                      <td className="num flag">{r.fecha}</td>
                      <td style={{ fontWeight: 600, whiteSpace: "normal" }}>{r.cliente}</td>
                      <td className="flag">{r.cargo}</td>
                      <td><BarraNota valor={r.promedio} ancho={130} /></td>
                      <td><span className={`tag ${tagNivel(r.promedio)}`}>{r.promedio >= 4.5 ? "Muy satisfecho" : r.promedio >= 3.5 ? "Satisfecho" : "Bajo meta"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen del periodo */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="chart-head">Resumen del Periodo <span className="hact">{anio}</span></div>
            <div className="card-body">
              <div style={{ display: "grid", gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="tag t-blue" style={{ flex: "0 0 auto" }}>Objetivo general</span>
                  <p style={{ flex: "1 1 400px", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
                    Evaluar el nivel de satisfacción de los clientes institucionales con el servicio prestado por Bio Steel de
                    Colombia, para identificar fortalezas y áreas de mejora que optimicen la calidad de la atención y los procesos.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="tag t-blue" style={{ flex: "0 0 auto" }}>Objetivo específico</span>
                  <p style={{ flex: "1 1 400px", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
                    Analizar eficacia, oportunidad, desempeño del personal y comunicación mediante una encuesta de 19 criterios
                    aplicada a los clientes institucionales.
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--ink)", margin: 0 }}>
                El consolidado de las {formatNumero(D.overall.total_encuestas)} encuestas institucionales registra un promedio general de{" "}
                <b>{nota(D.overall.promedio)}</b> sobre 5 ({pct1(D.overall.pct)}), {D.overall.promedio >= META ? "superando" : "por debajo de"} la meta de {nota(META)}.
                Las respuestas se concentran en 4 y 5{D.overall.dist["3"] || D.overall.dist["2"] || D.overall.dist["1"] ? "" : ", sin registros en 3, 2 ni 1"}.
                {compBajo && <> El componente de <b>{compBajo.nombre}</b> ({nota(compBajo.promedio)}) es la principal oportunidad de mejora.</>}
                {worst && <> La encuesta más baja fue <b>{worst.cliente}</b> ({nota(worst.promedio)}), que conviene seguir de cerca.</>}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* KPIs ortopedistas */}
          <div className="kpis" style={{ marginBottom: 12 }}>
            <div className={`kpi kc ${D.ortho.promedio >= META ? "k-ok" : "k-bad"}`}>
              <div className="klabel">Promedio general</div>
              <div className="kval num" style={{ color: tono(D.ortho.promedio) }}>{nota(D.ortho.promedio)}</div>
              <div className="ksub" style={{ color: "var(--muted)" }}>n = {formatNumero(D.ortho.n)} · escala 1–5</div>
            </div>
            <div className="kpi kc">
              <div className="klabel">Recomendaría el servicio</div>
              <div className="kval num">{pct1(D.ortho.recomendaria_pct)}</div>
              <div className="ksub" style={{ color: "var(--muted)" }}>de los encuestados</div>
            </div>
            <div className="kpi kc">
              <div className="klabel">Criterio más alto</div>
              <div className="kval num" style={{ color: tono(oBest?.val ?? 0) }}>{nota(oBest?.val ?? 0)}</div>
              <div className="ksub" style={{ color: "var(--muted)" }}>{oBest?.short ?? "—"}</div>
            </div>
            <div className={`kpi kc ${oWorst && oWorst.val >= META ? "k-ok" : "k-bad"}`}>
              <div className="klabel">Criterio a reforzar</div>
              <div className="kval num" style={{ color: tono(oWorst?.val ?? 0) }}>{nota(oWorst?.val ?? 0)}</div>
              <div className="ksub" style={{ color: "var(--muted)" }}>{oWorst?.short ?? "—"}</div>
            </div>
          </div>

          {/* Promedio por criterio */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="chart-head">Promedio por Criterio Evaluado <span className="hact">n = {formatNumero(D.ortho.n)} · {D.ortho.ciudades.join(", ")}</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {D.ortho.items.map((it) => (
                <div key={it.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13 }}>{it.label}</span>
                  <BarraNota valor={it.val} />
                </div>
              ))}
            </div>
          </div>

          {/* Nota metodológica */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="chart-head">Nota metodológica</div>
            <div className="card-body" style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)" }}>
              Desde 2026 la encuesta de Satisfacción del Cliente (Especialista) se amplió de 3 a 14 criterios, formato FOR-GC-011.
              El resultado se basa en {formatNumero(D.ortho.n)} respuesta(s){D.ortho.ciudades.length ? ` de ${D.ortho.ciudades.join(", ")}` : ""}.
              El {pct1(D.ortho.recomendaria_pct)} de los encuestados recomendaría los servicios de Bio Steel a otros profesionales o instituciones.
            </div>
          </div>
        </>
      )}
    </>
  );
}
