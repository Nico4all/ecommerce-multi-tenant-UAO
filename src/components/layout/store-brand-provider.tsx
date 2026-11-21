"use client";

import { createContext, useContext } from "react";
import type { StoreBrand } from "./store-brand";

const StoreBrandContext = createContext<StoreBrand | null>(null);

export function StoreBrandProvider({ brand, children }: { brand: StoreBrand; children: React.ReactNode }) {
  return <StoreBrandContext.Provider value={brand}>{children}</StoreBrandContext.Provider>;
}

export function useStoreBrand() {
  const brand = useContext(StoreBrandContext);
  if (!brand) throw new Error("Falta la identidad de la tienda validada");
  return brand;
}
