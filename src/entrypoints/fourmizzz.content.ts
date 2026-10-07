import { features } from "@/features";

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/*"],
  async main(ctx) {
    const url = new URL(location.href);
    for (const feature of features) {
      if (!feature.matches(url)) continue;
      try {
        await feature.run(ctx);
      } catch (error) {
        console.error(`[Optizzz] feature "${feature.id}" failed`, error);
      }
    }
  },
});
