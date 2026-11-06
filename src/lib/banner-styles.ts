/** Gradientes disponibles para banners y fondos de sección en el admin. */
export const BANNER_GRADIENTS = [
  { label: "Índigo → Violeta", value: "bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900 text-white" },
  { label: "Cielo → Esmeralda", value: "bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-600 text-white" },
  { label: "Esmeralda → Verde", value: "bg-gradient-to-br from-emerald-600 via-teal-600 to-green-800 text-white" },
  { label: "Naranja → Rojo", value: "bg-gradient-to-br from-orange-500 to-red-600 text-white" },
  { label: "Rosa → Magenta", value: "bg-gradient-to-br from-pink-500 to-rose-600 text-white" },
  { label: "Azul profundo", value: "bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 text-white" },
  { label: "Slate oscuro", value: "bg-gradient-to-br from-slate-800 to-slate-950 text-white" },
] as const;

/** Fondos para secciones completas (fila de productos con color de campaña). */
export const SECTION_BACKGROUNDS = [
  { label: "Sin fondo", value: "" },
  { label: "Azul mundialista", value: "bg-gradient-to-r from-blue-800 via-blue-700 to-blue-900" },
  { label: "Verde marca", value: "bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-800" },
  { label: "Naranja oferta", value: "bg-gradient-to-r from-orange-600 via-red-600 to-rose-700" },
  { label: "Violeta noche", value: "bg-gradient-to-r from-indigo-700 via-violet-700 to-slate-900" },
  { label: "Slate neutro", value: "bg-gradient-to-r from-slate-800 to-slate-900" },
] as const;
