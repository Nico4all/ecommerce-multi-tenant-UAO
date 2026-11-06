import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera el servidor mínimo que se copia a la imagen de producción.
  output: "standalone",

  // Paquetes Node que deben quedar como externos en el bundle de servidor
  // (driver de MariaDB, adaptador de Prisma y sharp, que es binario nativo).
  serverExternalPackages: [
    "@prisma/adapter-mariadb",
    "mariadb",
    "sharp",
    "nodemailer",
  ],

  // `sharp` carga en runtime un binario nativo y libvips desde paquetes
  // opcionales `@img`. El trazado de `standalone` puede detectar el binario y
  // omitir libvips, lo que rompe las subidas en Alpine (linux-musl).
  outputFileTracingIncludes: {
    "/api/admin/uploads": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
  },

  // Permite acceder al dev server desde otros equipos de la red local
  // (sin esto, Next 16 bloquea el HMR y los assets de desarrollo).
  // El comodín *.trycloudflare.com cubre el túnel con el que se prueba Wompi:
  // la URL del quick tunnel cambia en cada reinicio, así que fijar el nombre
  // exacto obligaba a editar este archivo cada vez (y mientras tanto el
  // WebSocket del HMR fallaba). Solo aplica en desarrollo.
  allowedDevOrigins: [
    "192.168.1.10",
    "192.168.1.11",
    "192.168.1.*",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
