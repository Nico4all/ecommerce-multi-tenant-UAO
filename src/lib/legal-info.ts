/**
 * Datos de contacto de la tienda que usan las 4 páginas legales (Términos,
 * Privacidad, Datos personales, Retracto).
 *
 * Por decisión del dueño NO se publican los datos personales del titular
 * (nombre completo, cédula/NIT ni dirección física): la tienda se identifica
 * solo por su nombre comercial, la ciudad y el correo de contacto.
 */
export const LEGAL_INFO = {
  /** Nombre con el que se conoce la tienda. */
  nombreComercial: "Variedades Los Primos",

  /** Ciudad donde opera: domicilio contractual y jurisdicción de los conflictos. */
  ciudad: "Cali",

  /** Correo para ejercer derechos de datos personales (Habeas Data). */
  correoDatos: "variedadeslosprimosc0l@gmail.com",

  /** Correo general de atención al cliente. */
  correoContacto: "variedadeslosprimosc0l@gmail.com",
} as const;
