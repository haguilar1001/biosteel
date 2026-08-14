"use client";
// ==========================================================
// Uploader in-app: sube cada archivo en su propia petición (secuencial) a
// /api/cargas (autenticada por sesión). Muestra progreso y resumen por archivo.
// ==========================================================
import { useState } from "react";

export interface DatasetPermitido { clave: string; titulo: string; archivoSugerido: string; }

interface ResDataset { titulo: string; archivo: string; hoja: string; filas: number; cargadas: number; omitidas: number; estrategia: string; }
interface Resultado { ok: boolean; datasets: Record<string, ResDataset>; errores: string[]; }

const nf = new Intl.NumberFormat("es-CO");

export function Uploader({ datasets }: { datasets: DatasetPermitido[] }) {
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);

  const total = Object.values(files).filter(Boolean).length;

  async function enviar() {
    if (total === 0 || cargando) return;
    setCargando(true);
    setRes(null);
    const seleccion = datasets.filter((d) => files[d.clave]);
    const acumulado: Record<string, ResDataset> = {};
    const errores: string[] = [];
    let ok = true;

    for (const d of seleccion) {
      setProgreso(d.titulo);
      try {
        const fd = new FormData();
        fd.append(d.clave, files[d.clave]!);
        const r = await fetch("/api/cargas", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (r.status === 401) { ok = false; errores.push(j.error || "Sesión no válida."); break; }
        if (j.datasets) Object.assign(acumulado, j.datasets);
        if (j.errores?.length) { ok = false; errores.push(...j.errores); }
        else if (!r.ok && !j.datasets) { ok = false; errores.push(j.error || `${d.titulo}: error ${r.status}.`); }
      } catch {
        ok = false;
        errores.push(`${d.titulo}: no se pudo subir (archivo muy grande o conexión interrumpida).`);
      }
    }

    setProgreso(null);
    setRes({ ok, datasets: acumulado, errores });
    if (ok) setFiles({});
    setCargando(false);
  }

  return (
    <div className="card">
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {datasets.map((d) => (
            <label key={d.clave} className="carga-fila" style={{
              display: "flex", alignItems: "center", gap: 14, background: "var(--surface)",
              border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", cursor: "pointer",
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flex: "0 0 auto", display: "grid", placeItems: "center",
                background: files[d.clave] ? "var(--ok-bg, #E7F4EC)" : "var(--panel, #eef2f7)", fontSize: 18,
              }}>{files[d.clave] ? "✅" : "📄"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{d.titulo}</div>
                <div className="flag" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {files[d.clave] ? files[d.clave]!.name : d.archivoSugerido}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", flex: "0 0 auto" }}>
                {files[d.clave] ? "Cambiar" : "Elegir"}
              </span>
              <input type="file" accept=".xlsx" hidden
                onChange={(e) => setFiles((p) => ({ ...p, [d.clave]: e.target.files?.[0] }))} />
            </label>
          ))}
        </div>

        <button onClick={enviar} disabled={total === 0 || cargando} className="btn" style={{
          padding: "12px 18px", background: total === 0 || cargando ? "var(--muted)" : "var(--brand)",
          color: "#fff", fontWeight: 700, border: "none",
        }}>
          {cargando ? "Cargando y procesando…" : total ? `Cargar ${total} archivo${total > 1 ? "s" : ""}` : "Elige al menos un archivo"}
        </button>

        {cargando && (
          <p className="flag" style={{ textAlign: "center", margin: 0 }}>
            {progreso ? <>Subiendo <strong>{progreso}</strong>… </> : null}Los archivos grandes pueden tardar. No cierres esta página.
          </p>
        )}

        {res && <ResultadoView res={res} />}
      </div>
    </div>
  );
}

function ResultadoView({ res }: { res: Resultado }) {
  const filas = Object.values(res.datasets);
  const titulo = res.ok ? "Carga completada" : filas.length ? "Carga con avisos" : "No se pudo cargar";
  const tono = res.ok ? "ok" : filas.length ? "warn" : "bad";
  const bg = tono === "ok" ? "#E7F4EC" : tono === "warn" ? "#FBEBD5" : "#FADBD6";
  const color = tono === "ok" ? "#1E7A46" : tono === "warn" ? "#9A5A00" : "#A5281B";

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginTop: 4 }}>
      <div style={{ background: bg, color, padding: "10px 14px", fontWeight: 800 }}>{titulo}</div>
      <div style={{ padding: 14 }}>
        {filas.length > 0 && (
          <div className="tbl-wrap">
            <table data-noorden>
              <thead>
                <tr><th>Archivo</th><th className="r">En archivo</th><th className="r">Cargadas</th></tr>
              </thead>
              <tbody>
                {filas.map((d) => (
                  <tr key={d.titulo}>
                    <td><strong>{d.titulo}</strong><br /><span className="flag">{d.estrategia}</span></td>
                    <td className="r num">{nf.format(d.filas)}</td>
                    <td className="r num" style={{ fontWeight: 700 }}>{nf.format(d.cargadas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {res.errores.length > 0 && (
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#A5281B" }}>
            {res.errores.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
