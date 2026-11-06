export const ORIGINAL_STORE_ID = "store-original";

export const initialStores = [
  {
    id: ORIGINAL_STORE_ID,
    slug: "variedades-los-primos",
    name: "Variedades Los Primos",
    active: true,
    legacyKey: "original",
  },
  {
    id: "store-frutas-del-valle",
    slug: "frutas-del-valle",
    name: "Frutas del Valle",
    active: false,
    legacyKey: null,
  },
] as const;
