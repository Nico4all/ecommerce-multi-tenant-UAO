/**
 * Ubicaciones para el formulario de envío: divisiones de nivel 1
 * (departamento / provincia / estado / región) por país, y para Colombia
 * también las ciudades principales por departamento.
 *
 * La ciudad se ofrece como sugerencias (datalist), no como lista cerrada: nadie
 * queda bloqueado si su municipio no está en la lista (puede escribirlo). Por
 * eso las listas de ciudades no pretenden ser exhaustivas, sino cubrir las más
 * comunes; el resto se escribe a mano.
 */

export interface CountryLocations {
  /** Cómo se llama el nivel 1 en ese país (para la etiqueta del campo). */
  stateLabel: string;
  /** Divisiones de nivel 1, ordenadas alfabéticamente. */
  states: string[];
  /** Ciudades sugeridas por división. Si falta, la ciudad es texto libre. */
  citiesByState?: Record<string, string[]>;
}

export const COUNTRIES = [
  "Colombia",
  "Ecuador",
  "Perú",
  "Panamá",
  "México",
  "Chile",
  "Argentina",
] as const;

export type Country = (typeof COUNTRIES)[number];

const COLOMBIA_CITIES: Record<string, string[]> = {
  "Bogotá D.C.": ["Bogotá"],
  Amazonas: ["Leticia", "Puerto Nariño"],
  Antioquia: [
    "Medellín", "Bello", "Itagüí", "Envigado", "Sabaneta", "Apartadó",
    "Rionegro", "Turbo", "Copacabana", "Caucasia", "La Ceja", "Marinilla",
    "Girardota", "Caldas",
  ],
  Arauca: ["Arauca", "Tame", "Saravena", "Arauquita", "Fortul"],
  Atlántico: [
    "Barranquilla", "Soledad", "Malambo", "Sabanalarga", "Puerto Colombia",
    "Galapa", "Baranoa",
  ],
  Bolívar: [
    "Cartagena", "Magangué", "Turbaco", "El Carmen de Bolívar", "Arjona",
    "Mompós",
  ],
  Boyacá: [
    "Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Paipa", "Puerto Boyacá",
  ],
  Caldas: [
    "Manizales", "Villamaría", "La Dorada", "Chinchiná", "Riosucio", "Anserma",
  ],
  Caquetá: ["Florencia", "San Vicente del Caguán", "Puerto Rico"],
  Casanare: ["Yopal", "Aguazul", "Villanueva", "Tauramena"],
  Cauca: [
    "Popayán", "Santander de Quilichao", "Puerto Tejada", "El Bordo", "Guapi",
  ],
  Cesar: [
    "Valledupar", "Aguachica", "Agustín Codazzi", "Bosconia",
    "La Jagua de Ibirico",
  ],
  Chocó: ["Quibdó", "Istmina", "Tadó", "Condoto", "Bahía Solano"],
  Córdoba: [
    "Montería", "Cereté", "Sahagún", "Lorica", "Montelíbano", "Planeta Rica",
    "Tierralta",
  ],
  Cundinamarca: [
    "Soacha", "Facatativá", "Zipaquirá", "Chía", "Girardot", "Fusagasugá",
    "Mosquera", "Madrid", "Funza", "Cajicá", "Sibaté", "Cota", "La Calera",
    "Villeta",
  ],
  Guainía: ["Inírida"],
  Guaviare: ["San José del Guaviare"],
  Huila: ["Neiva", "Pitalito", "Garzón", "La Plata", "Campoalegre"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "Fonseca", "San Juan del Cesar"],
  Magdalena: [
    "Santa Marta", "Ciénaga", "Fundación", "El Banco", "Zona Bananera",
  ],
  Meta: ["Villavicencio", "Acacías", "Granada", "Puerto López", "San Martín"],
  Nariño: ["Pasto", "Tumaco", "Ipiales", "Túquerres", "La Unión"],
  "Norte de Santander": [
    "Cúcuta", "Ocaña", "Villa del Rosario", "Los Patios", "Pamplona",
  ],
  Putumayo: ["Mocoa", "Puerto Asís", "Orito", "La Hormiga"],
  Quindío: ["Armenia", "Calarcá", "La Tebaida", "Montenegro", "Quimbaya"],
  Risaralda: ["Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  Santander: [
    "Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja",
    "San Gil", "Barbosa", "Socorro",
  ],
  Sucre: ["Sincelejo", "Corozal", "Sampués", "San Marcos", "Santiago de Tolú"],
  Tolima: [
    "Ibagué", "Espinal", "Melgar", "Honda", "Líbano", "Chaparral", "Mariquita",
  ],
  "Valle del Cauca": [
    "Cali", "Buenaventura", "Palmira", "Tuluá", "Buga", "Cartago", "Jamundí",
    "Yumbo", "Candelaria", "Florida", "Zarzal",
  ],
  Vaupés: ["Mitú"],
  Vichada: ["Puerto Carreño"],
};

export const LOCATIONS: Record<Country, CountryLocations> = {
  Colombia: {
    stateLabel: "Departamento",
    states: Object.keys(COLOMBIA_CITIES).sort((a, b) => a.localeCompare(b, "es")),
    citiesByState: COLOMBIA_CITIES,
  },
  Ecuador: {
    stateLabel: "Provincia",
    states: [
      "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi",
      "El Oro", "Esmeraldas", "Galápagos", "Guayas", "Imbabura", "Loja",
      "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana", "Pastaza",
      "Pichincha", "Santa Elena", "Santo Domingo de los Tsáchilas",
      "Sucumbíos", "Tungurahua", "Zamora Chinchipe",
    ],
  },
  Perú: {
    stateLabel: "Departamento",
    states: [
      "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca",
      "Callao", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín",
      "La Libertad", "Lambayeque", "Lima", "Loreto", "Madre de Dios",
      "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes",
      "Ucayali",
    ],
  },
  Panamá: {
    stateLabel: "Provincia",
    states: [
      "Bocas del Toro", "Chiriquí", "Coclé", "Colón", "Darién",
      "Emberá-Wounaan", "Guna Yala", "Herrera", "Los Santos", "Ngäbe-Buglé",
      "Panamá", "Panamá Oeste", "Veraguas",
    ],
  },
  México: {
    stateLabel: "Estado",
    states: [
      "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
      "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima",
      "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo",
      "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
      "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa",
      "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán",
      "Zacatecas",
    ],
  },
  Chile: {
    stateLabel: "Región",
    states: [
      "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo",
      "Valparaíso", "Metropolitana de Santiago", "O'Higgins", "Maule", "Ñuble",
      "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes",
    ],
  },
  Argentina: {
    stateLabel: "Provincia",
    states: [
      "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco",
      "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy",
      "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro",
      "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
      "Santiago del Estero", "Tierra del Fuego", "Tucumán",
    ],
  },
};

/** Etiqueta del nivel 1 para un país (con respaldo genérico). */
export function stateLabelFor(country: string): string {
  return LOCATIONS[country as Country]?.stateLabel ?? "Estado / Provincia";
}

/** Divisiones de nivel 1 de un país (vacío si no está en el catálogo). */
export function statesFor(country: string): string[] {
  return LOCATIONS[country as Country]?.states ?? [];
}

/** Ciudades sugeridas para un país + división (vacío si no hay). */
export function citiesFor(country: string, state: string): string[] {
  return LOCATIONS[country as Country]?.citiesByState?.[state] ?? [];
}

/** Todas las ciudades del país (para sugerir ciudad sin haber elegido división). */
export function allCitiesFor(country: string): string[] {
  const byState = LOCATIONS[country as Country]?.citiesByState;
  if (!byState) return [];
  const set = new Set<string>();
  for (const list of Object.values(byState)) for (const c of list) set.add(c);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Departamento/división al que pertenece una ciudad (coincidencia exacta), o
 * `null`. Permite autocompletar la división cuando se elige la ciudad primero.
 */
export function stateForCity(country: string, city: string): string | null {
  const byState = LOCATIONS[country as Country]?.citiesByState;
  if (!byState) return null;
  const target = city.trim().toLowerCase();
  if (!target) return null;
  for (const [state, list] of Object.entries(byState)) {
    if (list.some((c) => c.toLowerCase() === target)) return state;
  }
  return null;
}
