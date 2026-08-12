"use client";
// Formulario de filtro que se envía automáticamente al cambiar un <select>
// (sin botón "Ver"). Los campos de texto siguen enviándose con Enter.
import type { FormHTMLAttributes } from "react";

export function FiltroAuto(props: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      method="get"
      {...props}
      onChange={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === "SELECT") e.currentTarget.requestSubmit();
      }}
    />
  );
}
