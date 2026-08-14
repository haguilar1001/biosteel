"use client";
// Orden interno para tablas de componentes cliente (que se re-renderizan, así
// que no las toca el enhancer global). Estado de columna+dirección, alterna
// ASC/DESC al reclamar la misma columna, e indicador ▲/▼.
import { useState } from "react";

export type DirOrden = "asc" | "desc";

export function useOrden<C extends string>(colInicial: C, dirInicial: DirOrden = "desc") {
  const [orden, setOrden] = useState<{ col: C; dir: DirOrden }>({ col: colInicial, dir: dirInicial });

  const toggle = (col: C, defDir: DirOrden = "desc") =>
    setOrden((o) => (o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: defDir }));

  const ind = (col: C) => (orden.col === col ? (orden.dir === "asc" ? " ▲" : " ▼") : "");

  /** Devuelve una copia ordenada de `filas` según la columna activa. */
  function ordenar<T>(filas: T[], valor: (f: T, col: C) => number | string): T[] {
    const arr = [...filas];
    arr.sort((a, b) => {
      const va = valor(a, orden.col), vb = valor(b, orden.col);
      const c = typeof va === "string" ? va.localeCompare(vb as string, "es", { numeric: true }) : (va as number) - (vb as number);
      return orden.dir === "asc" ? c : -c;
    });
    return arr;
  }

  return { orden, toggle, ind, ordenar };
}
