import { withErrorHandling, jsonOk } from "@/lib/server/api-helpers";
import { getProducts, type SortKey } from "@/lib/queries";

const SORTS: SortKey[] = [
  "relevance",
  "price-asc",
  "price-desc",
  "rating",
  "discount",
];

export const GET = withErrorHandling(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const sortParam = sp.get("sort") as SortKey | null;

  const products = await getProducts({
    category: sp.get("category") ?? undefined,
    search: sp.get("search") ?? undefined,
    brands: sp.getAll("brand"),
    minRating: sp.get("minRating") ? Number(sp.get("minRating")) : undefined,
    onlyDeals: sp.get("onlyDeals") === "true",
    sort: sortParam && SORTS.includes(sortParam) ? sortParam : "relevance",
  });
  return jsonOk(products);
});
