"use client";
// ==========================================================
// Chat del asistente. Envía la pregunta al server action (motor local) y
// pinta la Respuesta: KPIs, ranking y tabla. Formateo local de montos
// (honra el toggle global data-montos, sin arrastrar Prisma al bundle).
// ==========================================================
import { useEffect, useRef, useState } from "react";
import { TopRanking } from "../_components/charts/TopRanking";
import { preguntarAction } from "./actions";
import type { Respuesta, Celda, Kpi } from "@/lib/negocio/consultas/tipos";

const nf0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cop = (v: number) => `$ ${nf0.format(Math.round(v))}`;
const pct = (v: number) => `${nf2.format(v)} %`;

function abreviar(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `$ ${nf2.format(v / 1e6)} M`;
  if (a >= 1e3) return `$ ${nf0.format(v / 1e3)} K`;
  return cop(v);
}

/** Monto que honra el toggle global (montos completos / resumidos). */
function Money({ v }: { v: number }) {
  return (
    <span className="monto">
      <span className="monto-full">{cop(v)}</span>
      <span className="monto-short">{abreviar(v)}</span>
    </span>
  );
}

const colorTono = (t?: "ok" | "bad" | "neutro") =>
  t === "ok" ? "var(--ok)" : t === "bad" ? "var(--bad)" : undefined;

function ValorCelda({ c }: { c: Celda }) {
  const style = { color: colorTono(c.tono) };
  if (c.tipo === "monto") return <span style={style}><Money v={Number(c.valor)} /></span>;
  if (c.tipo === "numero") return <span style={style}>{nf0.format(Number(c.valor))}</span>;
  if (c.tipo === "porcentaje") return <span style={style}>{pct(Number(c.valor))}</span>;
  return <span style={style}>{String(c.valor)}</span>;
}

function KpiCard({ k }: { k: Kpi }) {
  const cls = k.tono === "ok" ? "kpi k-ok" : k.tono === "bad" ? "kpi k-bad" : "kpi";
  return (
    <div className={cls}>
      <div className="klabel">{k.label}</div>
      <div className="kval">
        {k.tipo === "monto" ? <Money v={Number(k.valor)} />
          : k.tipo === "porcentaje" ? pct(Number(k.valor))
          : k.tipo === "numero" ? nf0.format(Number(k.valor))
          : String(k.valor)}
      </div>
    </div>
  );
}

function RespuestaView({ r }: { r: Respuesta }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{r.titulo}</div>
      {r.resumen && <p style={{ margin: 0, lineHeight: 1.5 }}>{r.resumen}</p>}

      {r.kpis && r.kpis.length > 0 && (
        <div className="kpis" style={{ marginBottom: 0 }}>
          {r.kpis.map((k, i) => <KpiCard key={i} k={k} />)}
        </div>
      )}

      {r.ranking && r.ranking.items.length > 0 && (
        <TopRanking
          titulo={r.ranking.titulo}
          items={r.ranking.items}
          color={r.ranking.color}
          inicial={r.ranking.inicial ?? 10}
          step={5}
        />
      )}

      {r.tabla && r.tabla.filas.length > 0 && (
        <div className="card">
          <div className="tbl-wrap">
            <table data-noorden>
              <thead>
                <tr>{r.tabla.columnas.map((col, i) => <th key={i} className={col.align === "r" ? "r" : undefined}>{col.titulo}</th>)}</tr>
              </thead>
              <tbody>
                {r.tabla.total && (
                  <tr className="fila-total">
                    {r.tabla.total.map((c, i) => (
                      <td key={i} className={`${r.tabla!.columnas[i]?.align === "r" ? "r num" : ""}`} style={{ fontWeight: 800 }}><ValorCelda c={c} /></td>
                    ))}
                  </tr>
                )}
                {r.tabla.filas.map((fila, fi) => (
                  <tr key={fi}>
                    {fila.map((c, ci) => (
                      <td key={ci} className={r.tabla!.columnas[ci]?.align === "r" ? "r num" : undefined}><ValorCelda c={c} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {r.nota && <p className="flag" style={{ margin: 0, fontStyle: "italic" }}>{r.nota}</p>}
    </div>
  );
}

interface Turno {
  pregunta: string;
  respuesta?: Respuesta;
  error?: boolean;
}

export function Chat({ ejemplos }: { ejemplos: string[] }) {
  const [texto, setTexto] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turnos, cargando]);

  async function preguntar(pregunta: string) {
    const q = pregunta.trim();
    if (!q || cargando) return;
    setTexto("");
    setTurnos((t) => [...t, { pregunta: q }]);
    setCargando(true);
    try {
      const respuesta = await preguntarAction(q);
      setTurnos((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, respuesta } : x)));
    } catch {
      setTurnos((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: true } : x)));
    } finally {
      setCargando(false);
      inputRef.current?.focus();
    }
  }

  const ultimaRespuesta = turnos.length ? turnos[turnos.length - 1]?.respuesta : undefined;
  const chips = ultimaRespuesta?.sugerencias?.length ? ultimaRespuesta.sugerencias : ejemplos;

  return (
    <div className="card">
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Conversación */}
        {turnos.length === 0 ? (
          <div className="empty" style={{ padding: "24px 12px" }}>
            Hazme una pregunta sobre tus datos. Prueba con una de estas:
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {turnos.map((t, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "var(--brand)", color: "#fff", padding: "9px 13px", borderRadius: 14, borderBottomRightRadius: 4, fontWeight: 600 }}>
                  {t.pregunta}
                </div>
                <div style={{ alignSelf: "flex-start", width: "100%" }}>
                  {t.respuesta ? <RespuestaView r={t.respuesta} />
                    : t.error ? <p className="flag" style={{ margin: 0 }}>Ocurrió un error. Intenta de nuevo.</p>
                    : <p className="flag" style={{ margin: 0 }}>Pensando…</p>}
                </div>
              </div>
            ))}
            <div ref={finRef} />
          </div>
        )}

        {/* Chips de sugerencias */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {chips.slice(0, 6).map((s, i) => (
            <button key={i} type="button" className="badge" style={{ cursor: "pointer", border: "1px solid var(--line)", background: "var(--surface)" }} disabled={cargando} onClick={() => preguntar(s)}>
              {s}
            </button>
          ))}
        </div>

        {/* Entrada */}
        <form onSubmit={(e) => { e.preventDefault(); preguntar(texto); }} className="toolbar" style={{ gap: 8 }}>
          <input
            ref={inputRef}
            className="select"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Escribe tu pregunta…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={cargando}
            autoFocus
          />
          <button type="submit" className="btn" disabled={cargando || !texto.trim()}>
            {cargando ? "…" : "Preguntar"}
          </button>
        </form>
      </div>
    </div>
  );
}
