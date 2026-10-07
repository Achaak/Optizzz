import { features } from "@/features";
import { runFeatures } from "@/features/run";
import { loadToggles } from "@/features/toggles";

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/*"],
  async main(ctx) {
    await runFeatures(features, new URL(location.href), await loadToggles(), ctx);
  },
});
