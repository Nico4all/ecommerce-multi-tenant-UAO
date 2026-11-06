"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_CITY } from "@/lib/colombia";

/**
 * Ciudad de envío elegida en la barra superior.
 *
 * Se guarda en localStorage y la reutiliza el checkout para rellenar la
 * dirección, así la elección de arriba sirve para algo de verdad.
 */
interface LocationState {
  city: string;
  state: string;
  setCity: (city: string, state: string) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      city: DEFAULT_CITY.name,
      state: DEFAULT_CITY.state,
      setCity: (city, state) => set({ city, state }),
    }),
    { name: "vlp-location" },
  ),
);
