"use client";
// Tabla de pendientes por IPS: cada IPS se expande (clic) y muestra sus pedidos
// (documento, fecha, motivo, días corridos, valor). Formateo local.
import { Fragment, useState } from "react";

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const cop = (v: number) => `$ ${nf.format(Math.round(v))}`;
const pct = (v: number) => `${v.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const fFecha = (d: Date) => new Date(d).toISOString().slice(0, 10);

export interface PedidoDet { nroDocumento: string; fecha: Date; subtotal: number; motivo: string; diasCorridos: number; }
export interface IpsItem { ips: string; pedidos: number; valor: number; diasProm: number; diasMax: number; detalle: PedidoDet[]; }

const colorDias = (d: number) => (d <= 15 ? "var(--ok)" : d <= 45 ? "var(--w1)" : "var(--bad)");

export function PendientesIpsTabla({ items, total }: { items: IpsItem[]; total: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (c: string) => setOpen((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const totalPedidos = items.reduce((s, i) => s + i.pedidos, 0);

  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>IPS</th><th className="r"># Pedidos</th><th className="r">Valor</th>
            <th className="r">% Part.</th><th className="r">Días prom.</th><th className="r">Días máx.</th>
          </tr>
        </thead>
        <tbody>
          <tr className="fila-total">
            <td style={{ fontWeight: 800 }}>Total · {items.length} IPS</td>
            <td className="r num" style={{ fontWeight: 800 }}>{nf.format(totalPedidos)}</td>
            <td className="r num" style={{ fontWeight: 800 }}>{cop(total)}</td>
            <td className="r num" style={{ fontWeight: 800 }}>{pct(100)}</td>
            <td className="r num"></td><td className="r num"></td>
          </tr>
          {items.map((c) => {
            const abierto = open.has(c.ips);
            return (
              <Fragment key={c.ips}>
                <tr onClick={() => toggle(c.ips)} style={{ cursor: "pointer", background: abierto ? "var(--brand-tint)" : undefined }}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                      <span style={{ width: 12, color: "var(--muted)", fontSize: 10, transition: "transform .12s", display: "inline-block", transform: abierto ? "rotate(90deg)" : "none" }}>▶</span>
                      {c.ips}
                    </span>
                  </td>
                  <td className="r num">{nf.format(c.pedidos)}</td>
                  <td className="r num" style={{ fontWeight: 700 }}>{cop(c.valor)}</td>
                  <td className="r num">{total !== 0 ? pct((c.valor / total) * 100) : "—"}</td>
                  <td className="r num">{c.diasProm}</td>
                  <td className="r num" style={{ fontWeight: 700, color: colorDias(c.diasMax) }}>{c.diasMax}</td>
                </tr>
                {abierto && c.detalle.map((d) => (
                  <tr key={d.nroDocumento} style={{ background: "color-mix(in srgb, var(--brand-tint) 55%, transparent)" }}>
                    <td style={{ paddingLeft: 34, color: "var(--muted)" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 360 }} title={d.motivo}>
                        ↳ {d.nroDocumento} · <span className="flag">{d.motivo}</span>
                      </span>
                    </td>
                    <td className="r num flag">{fFecha(d.fecha)}</td>
                    <td className="r num">{cop(d.subtotal)}</td>
                    <td className="r num"></td>
                    <td className="r num"></td>
                    <td className="r num" style={{ fontWeight: 700, color: colorDias(d.diasCorridos) }}>{d.diasCorridos}</td>
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
