// ==========================================================
// Malla de seguridad de las cargas que REEMPLAZAN un periodo entero.
//
// Balance y Movimientos de inventario no acumulan: borran el mes que trae el
// archivo y lo vuelven a escribir. Es a propósito —SIESA tarda en consolidar
// y el mismo mes se reexporta varias veces—, pero tiene un filo: subir un
// archivo con MENOS días de los que ya hay cargados borra el resto del mes
// sin decir nada.
//
// Cuando eso va a pasar, el procesador lanza CargaRequiereConfirmacion en vez
// de escribir. La API responde 409 con el detalle y la pantalla de carga se lo
// pregunta al usuario; si confirma, se reenvía el archivo con `confirmar=1` y
// el reemplazo sigue su curso. Nada se toca mientras no haya un sí explícito.
// ==========================================================

export class CargaRequiereConfirmacion extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CargaRequiereConfirmacion";
  }
}

export function esConfirmacionPendiente(e: unknown): e is CargaRequiereConfirmacion {
  return e instanceof CargaRequiereConfirmacion || (e instanceof Error && e.name === "CargaRequiereConfirmacion");
}
