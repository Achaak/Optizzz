import { SERVERS } from "@optizzz/game/servers";
import { siteToolPath } from "@optizzz/game/site-links/site";
import type { MetadataRoute } from "next";
import { TOOLS } from "~/components/tools/tool-list";
import { guidePath, WRITTEN_GUIDES } from "~/lib/guides/guides";

const SITE = "https://optizzz.fr";

/** The pages a search engine should know: the indexed ones only (player, alliance and Comparer pages say noindex). */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}) => ({
    url: `${SITE}${path}`,
    ...extra,
  });
  return [
    page("/", { changeFrequency: "hourly", priority: 1 }),
    page("/guides", { priority: 0.9 }),
    ...WRITTEN_GUIDES.map((entry) =>
      page(guidePath(entry.id), { lastModified: entry.updated, changeFrequency: "monthly", priority: 0.8 }),
    ),
    page("/tools", { priority: 0.8 }),
    ...TOOLS.filter((tool) => tool.ready).map((tool) => page(siteToolPath(tool.id), { priority: 0.7 })),
    ...SERVERS.flatMap((server) =>
      ["", "/players", "/alliances", "/journal", "/map"].map((section) =>
        page(`/${server.id}${section}`, { changeFrequency: "hourly", priority: section ? 0.5 : 0.6 }),
      ),
    ),
    page("/about", { priority: 0.5 }),
    page("/legal", { priority: 0.1 }),
    page("/privacy", { priority: 0.1 }),
  ];
}
