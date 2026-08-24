// ==========================================================
// Catálogo de listas de precios (código SIESA → nombre). Puro (sin
// server-only ni prisma): lo usan la pantalla de Consumos y el script de
// normalización. La base guarda el código sin ceros a la izquierda (4, 14…).
// ==========================================================
export const LISTA_NOMBRES: Record<string, string> = {
  "1": "INACTIVA", "2": "BARRIOS UNIDOS", "3": "ISS", "4": "SOAT", "5": "ARL",
  "6": "COOSALUD", "7": "ORTOPEDISTAS", "8": "REINA CATALINA",
  "9": "DISTRITO TURISTICO Y CULTURAL DE CTG", "10": "REEMPLAZOS POR PAQUETE",
  "11": "SALUD VIDA-REEMPLAZOS", "12": "LISTA PROVEMEDICS", "13": "SMS DE COLOMBIA",
  "14": "COOSALUD MAIS", "15": "COOSALUD EVENTOS", "16": "SURA",
  "17": "LISTA CLINICA LA POLICIA", "18": "CLINICA CARIBE", "19": "SELSALUD",
  "20": "ADRES", "21": "LISTA ADRES", "22": "LISTA PROVEMEDICS", "23": "ASMET SALUD",
  "24": "MEDFIX", "25": "SIMALINK", "26": "ABUMAC MEDICAL", "27": "DR. JUAN GABRIEL REATIGA",
  "999": "LISTA LIBRE",
};

/** Nombre de la lista a partir de su código; si ya viene como nombre (o no está
 *  en el catálogo), lo devuelve tal cual. Normaliza ceros a la izquierda. */
export function nombreLista(codigo: string): string {
  const norm = String(codigo).trim().replace(/^0+(?=\d)/, "");
  return LISTA_NOMBRES[norm] ?? codigo;
}

/** ¿El valor guardado es un código numérico (y por tanto hay que renombrarlo)? */
export function esCodigoLista(v: string): boolean {
  return /^\d+$/.test(String(v).trim());
}
