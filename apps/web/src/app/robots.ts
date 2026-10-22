import type { MetadataRoute } from "next";

// Player and alliance pages say `noindex` themselves (docs/features/site-public.md).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
}
