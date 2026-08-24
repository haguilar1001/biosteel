"use client";
// ==========================================================
// Embebe un informe HTML autónomo (servido desde /public) en un iframe
// aislado, ajustando la altura al contenido. El aislamiento evita que el
// CSS del informe (que redefine .card, .kpis, .grid…) choque con la app.
// ==========================================================
import { useEffect, useRef } from "react";

export function ReporteEmbed({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    let ro: ResizeObserver | null = null;

    const fit = () => {
      try {
        const doc = f.contentWindow?.document;
        if (doc) f.style.height = `${doc.documentElement.scrollHeight}px`;
      } catch { /* mismo origen: no debería fallar */ }
    };

    const onLoad = () => {
      fit();
      // Reajusta cuando el informe cambia de vista (chips) o los gráficos
      // terminan de dibujarse.
      try {
        const body = f.contentWindow?.document.body;
        if (body && "ResizeObserver" in window) { ro = new ResizeObserver(fit); ro.observe(body); }
      } catch { /* noop */ }
      setTimeout(fit, 300);
      setTimeout(fit, 1200);
    };

    f.addEventListener("load", onLoad);
    return () => { f.removeEventListener("load", onLoad); ro?.disconnect(); };
  }, [src]);

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      style={{ width: "100%", border: 0, display: "block", minHeight: 640, borderRadius: 12, overflow: "hidden" }}
    />
  );
}
