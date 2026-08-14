"use client";
// Tabla jerárquica de cartera por ciudad: cada ciudad se expande (clic) y
// muestra sus IPS con la participación sobre el total de LA CIUDAD.
// Formateo local (no importa @/lib/format para no arrastrar Prisma al bundle).
import { Fragment, useState } from "react";

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const cop = (v: number) => `$ ${nf.format(Math.round(v))}`;
const num = (v: number) => nf.format(Math.round(v));
const pct = (v: number) => `${v.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

export interface IpsCiudad { cliente: string; saldo: number; documentos: number; }
export interface CiudadItem {
  ciudad: string;
  saldo: number;
  documentos: number;
  clientes: number;
  color: string;
  ips: IpsCiudad[];
}

export function CiudadesTabla({ ciudades, total, totalDocs }: { ciudades: CiudadItem[]; total: number; totalDocs: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (c: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c); else n.add(c);
      return n;
    });

  return (
    <div className="tbl-wrap">
      <table data-noorden>
        <thead>
          <tr>
            <th>Ciudad</th><th className="r">Saldo neto</th><th className="r">% Part.</th>
            <th className="r">IPS / clientes</th><th className="r">Facturas</th>
          </tr>
        </thead>
        <tbody>
          <tr className="fila-total">
            <td style={{ fontWeight: 800 }}>Total · {ciudades.length} ciudades</td>
            <td className="r num" style={{ fontWeight: 800 }}>{cop(total)}</td>
            <td className="r num" style={{ fontWeight: 800 }}>{pct(100)}</td>
            <td className="r num"></td>
            <td className="r num" style={{ fontWeight: 800 }}>{num(totalDocs)}</td>
          </tr>
          {ciudades.map((c) => {
            const abierto = open.has(c.ciudad);
            return (
              <Fragment key={c.ciudad}>
                <tr onClick={() => toggle(c.ciudad)} style={{ cursor: "pointer", background: abierto ? "var(--brand-tint)" : undefined }}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                      <span style={{ width: 12, color: "var(--muted)", fontSize: 10, transition: "transform .12s", display: "inline-block", transform: abierto ? "rotate(90deg)" : "none" }}>▶</span>
                      <i style={{ width: 10, height: 10, borderRadius: 2, background: c.color, flex: "0 0 auto" }} />
                      {c.ciudad}
                    </span>
                  </td>
                  <td className="r num" style={{ fontWeight: 700 }}>{cop(c.saldo)}</td>
                  <td className="r num">{total !== 0 ? pct((c.saldo / total) * 100) : "—"}</td>
                  <td className="r num">{num(c.clientes)}</td>
                  <td className="r num">{num(c.documentos)}</td>
                </tr>
                {abierto &&
                  c.ips.map((ips) => (
                    <tr key={ips.cliente} style={{ background: "color-mix(in srgb, var(--brand-tint) 55%, transparent)" }}>
                      <td style={{ paddingLeft: 40, color: "var(--muted)" }} title={ips.cliente}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 320 }}>↳ {ips.cliente}</span>
                      </td>
                      <td className="r num">{cop(ips.saldo)}</td>
                      <td className="r num" style={{ color: "var(--muted)" }} title="Participación sobre el total de la ciudad">
                        {c.saldo !== 0 ? pct((ips.saldo / c.saldo) * 100) : "—"}
                      </td>
                      <td className="r num"></td>
                      <td className="r num" style={{ color: "var(--muted)" }}>{num(ips.documentos)}</td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
