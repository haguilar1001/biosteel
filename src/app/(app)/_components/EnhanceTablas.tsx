"use client";
// ==========================================================
// Hace ordenables (clic ASC/DESC) los encabezados de TODAS las tablas <table>
// de la app, sin reescribir cada pantalla. Se monta una vez en el layout y
// re-corre en cada navegación. Mejora solo tablas estáticas (server); las
// tablas de componentes que se re-renderizan se marcan con data-noorden.
//
// Detalles:
//  · Lee el valor de cada celda: atributo data-orden > texto de .monto-full >
//    texto de la celda (numérico si aplica, si no alfabético con locale es).
//  · Fija arriba las filas .fila-total (no se ordenan).
//  · Ignora filas de estado vacío (colspan) por desajuste de columnas.
// ==========================================================
import { useEffect } from "react";
import { usePathname } from "next/navigation";

function valorCelda(td: HTMLTableCellElement): { n: number | null; t: string } {
  const dataOrden = td.getAttribute("data-orden");
  if (dataOrden != null) {
    const n = Number(dataOrden);
    return { n: Number.isNaN(n) ? null : n, t: dataOrden };
  }
  const montoFull = td.querySelector(".monto-full");
  const texto = (montoFull?.textContent ?? td.textContent ?? "").trim();
  const limpio = texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = limpio === "" || limpio === "-" ? null : Number(limpio);
  return { n: Number.isNaN(n as number) ? null : n, t: texto };
}

function mejorar(tabla: HTMLTableElement) {
  if (tabla.dataset.ordenable === "1") return;
  const thead = tabla.tHead;
  const tbody = tabla.tBodies[0];
  if (!thead || !thead.rows.length || !tbody) return;
  const cuerpo: HTMLTableSectionElement = tbody;
  const filaTh = thead.rows[thead.rows.length - 1]!;
  const ths = Array.from(filaTh.cells);
  if (ths.length < 2) return;
  tabla.dataset.ordenable = "1";

  const estado = { col: -1, dir: 1 as 1 | -1 };

  function ordenar(col: number) {
    const dir: 1 | -1 = estado.col === col ? (estado.dir === 1 ? -1 : 1) : 1;
    estado.col = col; estado.dir = dir;

    const todas = Array.from(cuerpo.rows);
    const totales = todas.filter((r) => r.classList.contains("fila-total"));
    const datos = todas.filter((r) => !r.classList.contains("fila-total") && r.cells.length === ths.length);

    const conValor = datos.map((r) => ({ r, v: valorCelda(r.cells[col]!) }));
    const numericos = conValor.filter((x) => x.v.n != null).length;
    const esNum = numericos >= conValor.length * 0.6 && conValor.length > 0;

    conValor.sort((a, b) => {
      if (esNum) {
        if (a.v.n == null && b.v.n == null) return 0;
        if (a.v.n == null) return 1;   // vacíos al final
        if (b.v.n == null) return -1;
        return (a.v.n - b.v.n) * dir;
      }
      return a.v.t.localeCompare(b.v.t, "es", { numeric: true, sensitivity: "base" }) * dir;
    });

    for (const r of totales) cuerpo.appendChild(r);
    for (const x of conValor) cuerpo.appendChild(x.r);

    ths.forEach((th, i) => {
      let ind = th.querySelector<HTMLSpanElement>(".orden-ind");
      if (!ind) { ind = document.createElement("span"); ind.className = "orden-ind"; ind.style.opacity = "0.9"; th.appendChild(ind); }
      ind.textContent = i === col ? (dir === 1 ? " ▲" : " ▼") : "";
    });
  }

  ths.forEach((th, i) => {
    if (th.hasAttribute("data-noorden")) return;
    th.style.cursor = "pointer";
    th.style.userSelect = "none";
    th.setAttribute("title", "Clic para ordenar");
    th.addEventListener("click", () => ordenar(i));
  });
}

function mejorarTodas() {
  const tablas = document.querySelectorAll<HTMLTableElement>("table:not([data-noorden])");
  tablas.forEach((t) => {
    if (t.closest("[data-noorden]")) return;
    mejorar(t);
  });
}

export function EnhanceTablas() {
  const pathname = usePathname();
  useEffect(() => {
    // Doble pasada: inmediata y tras un tick (tablas que montan un poco después).
    mejorarTodas();
    const id = setTimeout(mejorarTodas, 120);
    return () => clearTimeout(id);
  }, [pathname]);
  return null;
}
