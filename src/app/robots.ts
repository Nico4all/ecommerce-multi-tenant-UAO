import type { MetadataRoute } from "next";
import { getStoreSeo } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { origin } = await getStoreSeo();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/uploads/"],
      disallow: [
        "/admin/",
        "/api/",
        "/cart",
        "/checkout",
        "/cuenta",
        "/forgot",
        "/login",
        "/orders",
        "/register",
        "/restablecer",
        "/search",
        "/wishlist",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
