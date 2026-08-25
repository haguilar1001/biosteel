// ==========================================================
// Recibo a Satisfacción de Dispositivos Médicos (FOR-ALM-005) — hoja imprimible.
// ==========================================================
import { formatFecha, formatFechaHoraSeg, formatCOP, formatNumero } from "@/lib/format";
import {
  DOCS_IMPORTACION, verifDocLabel, claseOpcion, tipoRecepcionLabel,
  type RecepcionDetalle,
} from "@/lib/negocio/recepcion";

const BADGE: Record<string, string> = { "t-ok": "activo", "t-bad": "de_baja", "t-blue": "pendiente" };

const NIT = "900.230.040-6";
const EMPRESA = "BioSteel de Colombia S.A.S";

function Campo({ k, v, full = false }: { k: string; v: React.ReactNode; full?: boolean }) {
  return (
    <div className={`sop-f${full ? " full" : ""}`}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export default function RecepcionDoc({ r }: { r: NonNullable<RecepcionDetalle> }) {
  const transporte = [
    r.transSinDanos && "Sin daños", r.transConDanos && "Con daños", r.transSelloViolado && "Sello violado",
    r.transTempAdecuada && "Temp. adecuada", r.transTempNoAdecuada && "Temp. no adecuada",
  ].filter(Boolean).join(" · ") || "—";

  return (
    <div className="sop-hoja">
      <div className="sop-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/BIOSTEEL.png" alt={EMPRESA} className="sop-logo" />
        <div className="sop-emp">
          <b>{EMPRESA}</b>
          <span>NIT {NIT}</span>
          <span>Recibo a satisfacción de dispositivos médicos</span>
        </div>
        <div className="sop-doc">
          <div className="t">FOR-ALM-005 · v3</div>
          <div className="c">{r.consecutivo}</div>
        </div>
      </div>

      <div className="sop-tipo">
        <span className="ico">📋</span>
        <span className="lbl">Recepción Técnica · {tipoRecepcionLabel(r.tipo)}</span>
        <span className="meta">Fecha inspección<br /><b>{formatFecha(r.fechaInspeccion)}</b></span>
      </div>

      <div className="sop-body">
        {/* 1. Datos */}
        <div className="sop-sec">
          <h3>1. Datos de recepción y proveedor</h3>
          <div className="sop-grid">
            <Campo k="Proveedor" v={r.proveedorNombre || "—"} />
            <Campo k="N° ODC / Pedido" v={r.odcPedido || "—"} />
            <Campo k="Registro INVIMA" v={r.registroInvima || "—"} />
            <Campo k="Factura / Remisión" v={r.facturaRemision || "—"} />
            <Campo k="Valor factura" v={r.valorFactura ? formatCOP(r.valorFactura) : "—"} />
            <Campo k="Hora recepción" v={r.horaRecepcion || "—"} />
            <Campo k="N° guía transporte" v={r.guiaTransporte || "—"} />
            <Campo k="Transportador" v={r.transportador || "—"} />
            <Campo k="N° lote despacho" v={r.loteDespacho || "—"} />
            <Campo k="Fecha caducidad" v={r.fechaCaducidad ? formatFecha(r.fechaCaducidad) : "—"} />
            <Campo k="Cant. ODC" v={r.cantOdc != null ? formatNumero(r.cantOdc) : "—"} />
          </div>
        </div>

        {/* 2. Documental */}
        <div className="sop-sec">
          <h3>2. Verificación documental previa</h3>
          <div className="sop-grid">
            {DOCS_IMPORTACION.map((d) => (
              <Campo key={d.campo} k={d.label} v={verifDocLabel(r[d.campo])} />
            ))}
            <Campo k="Condiciones de transporte / embalaje" v={transporte} full />
            {r.transObservacion && <Campo k="Observación transporte" v={r.transObservacion} full />}
          </div>
        </div>

        {/* 3. Inspección física */}
        <div className="sop-sec">
          <h3>3. Inspección física de los dispositivos</h3>
          {r.items.map((it, i) => (
            <div key={it.id} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                Ítem {i + 1}: {it.codigo ? `${it.codigo} · ` : ""}{it.descripcion}
              </div>
              <table className="sop-tabla" style={{ marginBottom: 4 }}>
                <thead>
                  <tr><th>Especificación</th><th style={{ textAlign: "right" }}>Cant. pedida</th><th style={{ textAlign: "right" }}>Cant. recibida</th><th>Lote</th><th>Caducidad</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{it.especificacion || "—"}</td>
                    <td className="num">{formatNumero(it.cantPedida)}</td>
                    <td className="num">{formatNumero(it.cantRecibida)}</td>
                    <td>{it.lote || "—"}</td>
                    <td>{it.fechaCaducidad ? formatFecha(it.fechaCaducidad) : "—"}</td>
                  </tr>
                </tbody>
              </table>
              <table className="sop-tabla">
                <thead><tr><th style={{ width: "26%" }}>Criterio</th><th>Especificación requerida</th><th style={{ width: "22%" }}>Resultado</th></tr></thead>
                <tbody>
                  {it.criterios.map((c, k) => (
                    <tr key={c.id}>
                      <td><b>C{k + 1}.</b> {c.criterio}</td>
                      <td style={{ fontSize: 10.5 }}>{c.especificacion}</td>
                      <td><span className={`sop-badge ${BADGE[claseOpcion(c.resultado)] ?? "pendiente"}`}>{c.resultado}</span></td>
                    </tr>
                  ))}
                  {it.criterios.length === 0 && <tr><td colSpan={3}>Sin criterios registrados.</td></tr>}
                </tbody>
              </table>
              {it.observaciones && <div className="flag" style={{ fontSize: 11, marginTop: 3 }}>Obs.: {it.observaciones}</div>}
            </div>
          ))}
        </div>

        {/* 4. Disposición */}
        <div className="sop-sec">
          <h3>4. Disposición del lote y decisión final</h3>
          <div className="sop-grid">
            <Campo k="Resultado" v={r.resultado || "—"} />
            <Campo k="Área de destino" v={r.areaDestino || "—"} />
            <Campo k="Decisión" v={r.decision || "—"} />
            <Campo k="Acción a tomar" v={r.accionTomar || "—"} />
            <Campo k="Validación factura" v={r.validacionFactura || "—"} full />
          </div>
        </div>
      </div>

      <div className="sop-firmas">
        <div className="sop-firma"><div className="linea" /><div className="nom">{r.recibidoPor || "—"}</div><div className="rol">Recibido por</div></div>
        <div className="sop-firma"><div className="linea" /><div className="nom">{r.revisadoPor || "—"}</div><div className="rol">Revisado por</div></div>
      </div>
      <div className="sop-firmas" style={{ marginTop: 8 }}>
        <div className="sop-firma"><div className="linea" /><div className="nom">{r.aprobadoPor || "—"}</div><div className="rol">Aprobado por</div></div>
        <div className="sop-firma" />
      </div>

      <div className="sop-foot">
        <span>Consecutivo {r.consecutivo} · registrado {formatFechaHoraSeg(r.createdAt)}{r.notas ? ` · ${r.notas}` : ""}</span>
        <span>FOR-ALM-005 v3 · sistema BioSteel</span>
      </div>
    </div>
  );
}
