// ==========================================================
// Catálogo de preguntas de las encuestas de satisfacción (puro, sin
// server-only). Lo usan el importador, el cálculo del informe y la plantilla.
// ==========================================================

export interface PreguntaInst { codigo: string; pregunta: string; comp: string }
export interface Componente { clave: string; nombre: string }
export interface CriterioOrtho { codigo: string; label: string; short: string }

/** 4 componentes de la encuesta institucional (por prefijo del código). */
export const COMPONENTES: Componente[] = [
  { clave: "1", nombre: "Eficacia del servicio" },
  { clave: "2", nombre: "Oportunidad del servicio" },
  { clave: "3", nombre: "Desempeño del personal" },
  { clave: "4", nombre: "Comunicación" },
];

/** 19 preguntas de la encuesta institucional. */
export const PREGUNTAS_INST: PreguntaInst[] = [
  { codigo: "1.1", comp: "1", pregunta: "Agilidad y rapidez de la prestación del servicio" },
  { codigo: "1.2", comp: "1", pregunta: "Ejecución correcta del servicio y a la primera vez" },
  { codigo: "1.3", comp: "1", pregunta: "Capacidad de reacción ante imprevistos/urgencias" },
  { codigo: "1.4", comp: "1", pregunta: "Claridad de la información" },
  { codigo: "2.1", comp: "2", pregunta: "Tiempos de respuesta para suministro de material de osteosíntesis" },
  { codigo: "2.2", comp: "2", pregunta: "Tiempos de respuesta para envío de cotizaciones" },
  { codigo: "2.3", comp: "2", pregunta: "Tiempos de respuesta para envío de facturas" },
  { codigo: "2.4", comp: "2", pregunta: "Facilidad para contactar responsable de cotizaciones" },
  { codigo: "2.5", comp: "2", pregunta: "Facilidad para contactar responsable de facturación" },
  { codigo: "2.6", comp: "2", pregunta: "Facilidad para contactar responsable de contabilidad" },
  { codigo: "2.7", comp: "2", pregunta: "Facilidad para contactar responsable de asesoría quirúrgica" },
  { codigo: "3.1", comp: "3", pregunta: "Preparación y capacitación del personal" },
  { codigo: "3.2", comp: "3", pregunta: "Actitud y cortesía del personal" },
  { codigo: "3.3", comp: "3", pregunta: "Claridad en explicaciones, requisitos y documentación" },
  { codigo: "3.4", comp: "3", pregunta: "Presentación personal de los funcionarios" },
  { codigo: "4.1", comp: "4", pregunta: "Comunicación oportuna con los procesos" },
  { codigo: "4.2", comp: "4", pregunta: "Información oportuna sobre novedades, cambios o demoras" },
  { codigo: "4.3", comp: "4", pregunta: "Claridad y comprensión de la información" },
  { codigo: "4.4", comp: "4", pregunta: "Coherencia de la información entre procesos" },
];

/** 14 criterios de la encuesta de ortopedistas (en el orden del formulario). */
export const CRITERIOS_ORTHO: CriterioOrtho[] = [
  { codigo: "O1", short: "Claridad info", label: "Claridad y precisión de la información solicitada" },
  { codigo: "O2", short: "Amabilidad", label: "Amabilidad y disposición del personal para atender solicitudes" },
  { codigo: "O3", short: "Rapidez info", label: "Rapidez en la entrega de la información solicitada" },
  { codigo: "O4", short: "Variedad productos", label: "Variedad y disponibilidad de productos ofrecidos" },
  { codigo: "O5", short: "Tiempos entrega", label: "Cumplimiento en los tiempos de entrega del material solicitado" },
  { codigo: "O6", short: "Conoc. técnico", label: "Conocimiento técnico y asesoría brindada por el personal" },
  { codigo: "O7", short: "Conoc. asesor", label: "Nivel de conocimiento técnico del asesor quirúrgico" },
  { codigo: "O8", short: "Disp. asesor", label: "Cumplimiento en la disponibilidad del asesor asignado" },
  { codigo: "O9", short: "Acompañamiento", label: "Oportunidad de respuesta y acompañamiento en procedimientos quirúrgicos" },
  { codigo: "O10", short: "Postventa", label: "Seguimiento postventa a requerimientos o inquietudes" },
  { codigo: "O11", short: "Com. logística", label: "Facilidad de comunicación con el equipo logístico o servicio al cliente" },
  { codigo: "O12", short: "Contacto admin", label: "Facilidad de contacto con el proceso administrativo" },
  { codigo: "O13", short: "Orientación", label: "Calidad de la orientación brindada antes, durante y después del procedimiento" },
  { codigo: "O14", short: "Satisf. general", label: "Satisfacción general con la calidad del servicio" },
];

export function nivelSatisfaccion(v: number): string {
  if (v >= 4.5) return "Muy satisfecho";
  if (v >= 3.5) return "Satisfecho";
  if (v >= 2.5) return "Algo satisfecho";
  if (v >= 1.5) return "Insatisfecho";
  return "Muy insatisfecho";
}
