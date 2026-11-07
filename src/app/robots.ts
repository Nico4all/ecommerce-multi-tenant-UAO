import type { MetadataRoute } from "next";
import { getStoreContext } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { origin } = await getStoreContext();
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
