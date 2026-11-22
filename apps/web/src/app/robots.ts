import type { MetadataRoute } from "next";

// Only the pages of the sitemap. Player and alliance pages say `noindex`, but robots loaded them anyway, along with
// Comparer and every query of the lists and the map: endless pages, each rendered on the VPS. On 2026-11-21, 80 of
// the first 85 requests of Caddy's access log were GPTBot and Amazonbot there (docs/features/site-public.md).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/*/players/", "/*/alliances/", "/*/compare", "/*?"],
    },
    sitemap: "https://optizzz.fr/sitemap.xml",
  };
}
