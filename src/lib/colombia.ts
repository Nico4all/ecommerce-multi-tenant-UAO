/**
 * Datos de Colombia compartidos por la tienda.
 * La tienda opera sobre todo en Colombia; los envíos a otros países se cotizan
 * aparte pero el cobro siempre es en pesos colombianos (ver lib/format.ts).
 */

export interface City {
  /** Nombre de la ciudad, tal como se muestra y se guarda en la dirección. */
  name: string;
  /** Departamento al que pertenece. */
  state: string;
  /** Días hábiles estimados de entrega. */
  days: number;
}

/** Ciudades con cobertura, ordenadas por tamaño. */
export const CITIES: City[] = [
  { name: "Bogotá", state: "Bogotá D.C.", days: 1 },
  { name: "Medellín", state: "Antioquia", days: 2 },
  { name: "Cali", state: "Valle del Cauca", days: 2 },
  { name: "Barranquilla", state: "Atlántico", days: 2 },
  { name: "Cartagena", state: "Bolívar", days: 3 },
  { name: "Bucaramanga", state: "Santander", days: 2 },
  { name: "Pereira", state: "Risaralda", days: 2 },
  { name: "Santa Marta", state: "Magdalena", days: 3 },
  { name: "Cúcuta", state: "Norte de Santander", days: 3 },
  { name: "Ibagué", state: "Tolima", days: 2 },
  { name: "Manizales", state: "Caldas", days: 2 },
  { name: "Villavicencio", state: "Meta", days: 2 },
  { name: "Armenia", state: "Quindío", days: 2 },
  { name: "Neiva", state: "Huila", days: 3 },
  { name: "Pasto", state: "Nariño", days: 4 },
];

export const DEFAULT_CITY = CITIES[0];

export function cityByName(name: string): City | undefined {
  return CITIES.find((c) => c.name === name);
}

/** Países a los que se puede enviar. El cobro siempre va en COP. */
export const COUNTRIES = [
  "Colombia",
  "Ecuador",
  "Perú",
  "Panamá",
  "México",
  "Chile",
  "Argentina",
] as const;
