"use client";
// ==========================================================
// Formulario público de carga diaria de S1ESA (módulo PENDIENTES).
// Fuera de la app: la auxiliar abre el link con ?token=… y sube los 4 .xlsx.
// El token viaja a /api/cargar, que valida, reemplaza cada dataset y responde
// con el resumen (filas cargadas / omitidas / errores).
// ==========================================================
import { useEffect, useState } from "react";

interface DatasetInfo { clave: string; titulo: string; archivoSugerido: string; }
const DATASETS: DatasetInfo[] = [
  { clave: "pendientes", titulo: "Pedidos pendientes acumulados", archivoSugerido: "PEDIDOS PENDIENTES ACUMULADOS.xlsx" },
  { clave: "facturacion", titulo: "Datos facturación", archivoSugerido: "DATOS FACTURACIÓN.xlsx" },
  { clave: "gastos", titulo: "Gastos", archivoSugerido: "GASTOS.xlsx" },
  { clave: "anuladas", titulo: "Motivo facturas anuladas", archivoSugerido: "MOTIVO FACTURAS ANULADAS.xlsx" },
];

interface ResDataset { titulo: string; archivo: string; hoja: string; filas: number; omitidas: number; }
interface Resultado {
  status: number;
  ok?: boolean;
  error?: string;
  datasets?: Record<string, ResDataset>;
  errores?: string[];
}

const nf = new Intl.NumberFormat("es-CO");

export default function CargaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
  }, []);

  const total = Object.values(files).filter(Boolean).length;

  // Sube cada archivo en su PROPIA petición (secuencial): peticiones más
  // pequeñas y con feedback por archivo (evita cortes por tamaño del cuerpo).
  async function enviar() {
    if (!token || total === 0 || cargando) return;
    setCargando(true);
    setRes(null);
    const seleccion = DATASETS.filter((d) => files[d.clave]);
    const datasets: Record<string, ResDataset> = {};
    const errores: string[] = [];
    let ok = true;
    let lastStatus = 200;

    for (const d of seleccion) {
      setProgreso(d.titulo);
      try {
        const fd = new FormData();
        fd.append(d.clave, files[d.clave]!);
        const r = await fetch(`/api/cargar?token=${encodeURIComponent(token)}`, { method: "POST", body: fd });
        lastStatus = r.status;
        if (r.status === 401) { ok = false; errores.push("Token inválido."); break; }
        const j = await r.json().catch(() => ({}));
        if (j.datasets) Object.assign(datasets, j.datasets);
        if (j.errores?.length) { ok = false; errores.push(...j.errores); }
        else if (!r.ok && !j.datasets) { ok = false; errores.push(`${d.titulo}: error ${r.status}.`); }
      } catch {
        ok = false;
        errores.push(`${d.titulo}: no se pudo subir (archivo muy grande o conexión interrumpida).`);
      }
    }

    setProgreso(null);
    setRes({ status: lastStatus, ok, datasets, errores });
    if (ok) setFiles({});
    setCargando(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EFF3F8", color: "#1B2434", fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 18px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 26 }}>🦴</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#2A4F98" }}>BioSteel · S1ESA</div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Carga diaria — Pendientes</h1>
          </div>
        </div>
        <p style={{ color: "#5B6B82", marginTop: 4, marginBottom: 22 }}>
          Sube los archivos del día exportados de S1ESA en <strong>.xlsx</strong>. Puedes subir uno o varios; cada uno reemplaza sus datos anteriores.
        </p>

        {token === null && (
          <div style={{ background: "#FADBD6", color: "#A5281B", border: "1px solid #f3b9b1", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
            ⚠️ Falta el <strong>token</strong> en el enlace. Usa el link completo que te compartieron (termina en <code>?token=…</code>).
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DATASETS.map((d) => (
            <label key={d.clave} style={{
              display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #E3E9F1",
              borderRadius: 12, padding: "14px 16px", cursor: "pointer", boxShadow: "0 1px 2px rgba(27,36,52,.04)",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flex: "0 0 auto", display: "grid", placeItems: "center",
                background: files[d.clave] ? "#E7F4EC" : "#EEF2F7", fontSize: 18,
              }}>{files[d.clave] ? "✅" : "📄"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{d.titulo}</div>
                <div style={{ fontSize: 12.5, color: "#5B6B82", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {files[d.clave] ? files[d.clave]!.name : d.archivoSugerido}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#2A4F98", flex: "0 0 auto" }}>
                {files[d.clave] ? "Cambiar" : "Elegir"}
              </span>
              <input
                type="file" accept=".xlsx" hidden
                onChange={(e) => setFiles((p) => ({ ...p, [d.clave]: e.target.files?.[0] }))}
              />
            </label>
          ))}
        </div>

        <button
          onClick={enviar}
          disabled={!token || total === 0 || cargando}
          style={{
            marginTop: 20, width: "100%", padding: "14px 18px", borderRadius: 10, border: "none",
            background: !token || total === 0 || cargando ? "#9fb0cf" : "#2A4F98", color: "#fff",
            fontSize: 15, fontWeight: 700, cursor: !token || total === 0 || cargando ? "default" : "pointer",
          }}
        >
          {cargando ? "Cargando y procesando…" : total ? `Cargar ${total} archivo${total > 1 ? "s" : ""}` : "Elige al menos un archivo"}
        </button>

        {cargando && (
          <p style={{ color: "#5B6B82", fontSize: 13, textAlign: "center", marginTop: 10 }}>
            {progreso ? <>Subiendo <strong>{progreso}</strong>… </> : null}Los archivos grandes (facturación / gastos) pueden tardar un momento. No cierres esta página.
          </p>
        )}

        {res && <Resultado res={res} />}
      </div>
    </div>
  );
}

function Resultado({ res }: { res: Resultado }) {
  const exito = res.status >= 200 && res.status < 300 && res.ok;
  const parcial = res.status === 207;
  const color = exito ? "#1E7A46" : parcial ? "#9A5A00" : "#A5281B";
  const bg = exito ? "#E7F4EC" : parcial ? "#FBEBD5" : "#FADBD6";
  const titulo = res.status === 401 ? "Token inválido" : exito ? "Carga completada" : parcial ? "Carga con avisos" : "No se pudo cargar";

  const filas = res.datasets ? Object.values(res.datasets) : [];

  return (
    <div style={{ marginTop: 22, background: "#fff", border: "1px solid #E3E9F1", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ background: bg, color, padding: "12px 16px", fontWeight: 800 }}>{titulo}</div>
      <div style={{ padding: 16 }}>
        {res.error && <p style={{ margin: 0, color }}>{res.error}</p>}
        {filas.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#5B6B82", textAlign: "left" }}>
                <th style={{ padding: "6px 0" }}>Archivo</th>
                <th style={{ padding: "6px 0", textAlign: "right" }}>Filas</th>
                <th style={{ padding: "6px 0", textAlign: "right" }}>Omitidas</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((d) => (
                <tr key={d.titulo} style={{ borderTop: "1px solid #EEF2F7" }}>
                  <td style={{ padding: "7px 0" }}><strong>{d.titulo}</strong><br /><span style={{ color: "#5B6B82", fontSize: 12 }}>{d.archivo}</span></td>
                  <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 700 }}>{nf.format(d.filas)}</td>
                  <td style={{ padding: "7px 0", textAlign: "right", color: d.omitidas ? "#9A5A00" : "#5B6B82" }}>{nf.format(d.omitidas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {res.errores && res.errores.length > 0 && (
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "#A5281B" }}>
            {res.errores.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
