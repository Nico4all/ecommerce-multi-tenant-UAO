"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Mantiene la página al día sin que el usuario refresque.
 *
 * Se apoya en `router.refresh()`: vuelve a ejecutar el componente de servidor y
 * baja los datos nuevos por props, SIN recargar la página ni perder el estado
 * del cliente (filtros, pestaña activa, texto escrito, posición del scroll).
 *
 * No usa WebSocket a propósito: para una tienda, preguntar cada pocos segundos
 * da el mismo resultado percibido sin exigir un servidor con conexiones
 * permanentes (que además no funciona en hostings serverless) ni añadir una
 * pieza más que se pueda caer en producción.
 *
 * Se detiene cuando la pestaña no está visible —nadie está mirando, no tiene
 * sentido gastar peticiones— y al volver refresca de inmediato, así lo primero
 * que ves al regresar ya está actualizado.
 *
 * Se monta como `<AutoRefresh seconds={20} />` y no pinta nada.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) timer = setInterval(() => router.refresh(), seconds * 1000);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh(); // ponerse al día antes de reanudar el ciclo
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, seconds]);

  return null;
}
