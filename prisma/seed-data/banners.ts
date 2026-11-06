import type { Banner } from "@/types";

/** Slides del carrusel hero principal. */
export const heroSlides: Banner[] = [
  {
    id: "h1",
    title: "iPhone 16 Pro Max",
    subtitle: "Chip A18. Súper rápido. La mejor cámara.",
    highlight: "Desde $5.912.000",
    cta: "Comprar ahora",
    href: "/category/electronica",
    className:
      "bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900 text-white",
  },
  {
    id: "h2",
    title: "Rebajas de Temporada",
    subtitle: "En calzado y ropa deportiva seleccionada",
    highlight: "Hasta 50% OFF",
    cta: "Ver ofertas",
    href: "/category/deportes",
    className:
      "bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-600 text-white",
  },
  {
    id: "h3",
    title: "Todo para tu Hogar",
    subtitle: "Renueva tus espacios con envío gratis",
    highlight: "Envío gratis",
    cta: "Explorar hogar",
    href: "/category/hogar",
    className:
      "bg-gradient-to-br from-emerald-600 via-teal-600 to-green-800 text-white",
  },
];

/** Banner lateral del hero. */
export const heroSide: Banner = {
  id: "hs1",
  title: "Ofertas Relámpago",
  highlight: "50%",
  subtitle: "Solo por hoy",
  cta: "Comprar",
  href: "/category/lujo",
  className: "bg-gradient-to-br from-orange-500 to-red-600 text-white",
};

/** Los 3 banners promocionales de en medio. */
export const promoBanners: Banner[] = [
  {
    id: "pb1",
    title: "Frutas y Verduras Frescas",
    subtitle: "Entrega el mismo día",
    highlight: "50% OFF",
    cta: "Comprar ahora",
    href: "/category/supermercado",
    className: "bg-gradient-to-br from-pink-500 to-rose-600 text-white",
  },
  {
    id: "pb2",
    title: "Galaxy S24 FE",
    subtitle: "Galaxy AI ya está aquí",
    cta: "Comprar ahora",
    href: "/category/electronica",
    className: "bg-gradient-to-br from-sky-400 to-blue-600 text-white",
  },
  {
    id: "pb3",
    title: "Despensa Los Primos",
    subtitle: "Antes de que se agote",
    highlight: "Oferta",
    cta: "Ver más",
    href: "/category/supermercado",
    className: "bg-gradient-to-br from-red-500 to-orange-600 text-white",
  },
];

/** Banner promocional full-width (experiencia con IA). */
export const promoStrip: Banner = {
  id: "ps1",
  title: "Los Primos IA",
  subtitle: "Experiencia de compra potenciada por inteligencia artificial",
  cta: "Probar ahora",
  href: "/",
  className:
    "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white",
};
