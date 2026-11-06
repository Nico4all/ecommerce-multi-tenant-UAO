import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getProducts, getCategories } from "@/lib/queries";

/**
 * Sugerencias para el autocompletado del buscador de la tienda.
 * Público (no toca /api/admin). Devuelve pocos resultados: es para el desplegable
 * mientras el cliente escribe, no la página de resultados completa (`/search`).
 */
export const GET = withErrorHandling(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return jsonOk({ products: [], categories: [] });

  const [products, categories] = await Promise.all([
    getProducts({ search: q }),
    getCategories(),
  ]);

  const ql = q.toLowerCase();
  return jsonOk({
    products: products.slice(0, 6).map((p) => ({
      slug: p.slug,
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrl,
      category: p.category,
    })),
    categories: categories
      .filter((c) => c.name.toLowerCase().includes(ql))
      .slice(0, 3)
      .map((c) => ({ slug: c.slug, name: c.name })),
  });
});
