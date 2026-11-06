import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
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
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
