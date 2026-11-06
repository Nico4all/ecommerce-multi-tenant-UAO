import type { Category } from "@/types";

export const categories: Category[] = [
  {
    slug: "electronica",
    name: "Electrónica",
    icon: "smartphone",
    gradient: "from-sky-500/15 to-blue-600/15 text-blue-700 dark:text-blue-300",
  },
  {
    slug: "moda",
    name: "Moda",
    icon: "shirt",
    gradient: "from-pink-500/15 to-rose-600/15 text-rose-700 dark:text-rose-300",
  },
  {
    slug: "lujo",
    name: "Lujo",
    icon: "gem",
    gradient:
      "from-amber-400/15 to-yellow-600/15 text-amber-700 dark:text-amber-300",
  },
  {
    slug: "hogar",
    name: "Hogar",
    icon: "sofa",
    gradient:
      "from-emerald-500/15 to-teal-600/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    slug: "belleza",
    name: "Salud y Belleza",
    icon: "sparkles",
    gradient:
      "from-fuchsia-500/15 to-purple-600/15 text-fuchsia-700 dark:text-fuchsia-300",
  },
  {
    slug: "supermercado",
    name: "Supermercado",
    icon: "shopping-basket",
    gradient:
      "from-lime-500/15 to-green-600/15 text-lime-700 dark:text-lime-300",
  },
  {
    slug: "deportes",
    name: "Deportes",
    icon: "dumbbell",
    gradient:
      "from-orange-500/15 to-red-600/15 text-orange-700 dark:text-orange-300",
  },
  {
    slug: "juguetes",
    name: "Juguetes",
    icon: "toy-brick",
    gradient:
      "from-cyan-500/15 to-indigo-600/15 text-cyan-700 dark:text-cyan-300",
  },
];

export const categoryBySlug = Object.fromEntries(
  categories.map((c) => [c.slug, c]),
) as Record<Category["slug"], Category>;
