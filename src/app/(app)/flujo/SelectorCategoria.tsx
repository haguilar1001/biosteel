"use client";
// Selector inline para reclasificar un movimiento. Al cambiar, guarda y refresca.
import { useState, useTransition } from "react";
import { reclasificarAction } from "./actions";

interface Cat { id: number; nombre: string }

export function SelectorCategoria({ movimientoId, categoriaId, categorias }: { movimientoId: number; categoriaId: number | null; categorias: Cat[] }) {
  const [pending, start] = useTransition();
  const [valor, setValor] = useState<string>(categoriaId != null ? String(categoriaId) : "");
  const [error, setError] = useState(false);

  const onChange = (v: string) => {
    setValor(v);
    setError(false);
    start(async () => {
      const res = await reclasificarAction(movimientoId, v ? Number(v) : null);
      if (res.error) setError(true);
    });
  };

  return (
    <select
      value={valor}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className="select"
      title={error ? "No se pudo guardar" : "Cambiar categoría"}
      style={{ fontSize: 12, padding: "2px 4px", maxWidth: "100%", borderColor: error ? "var(--bad)" : undefined, opacity: pending ? 0.6 : 1 }}
    >
      <option value="">(Sin categoría)</option>
      {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
    </select>
  );
}
