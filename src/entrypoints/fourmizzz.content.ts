import { features } from "@/features";
import { runFeatures } from "@/features/run";
import { loadToggles } from "@/features/toggles";
import { injectTheme } from "@/theme";

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/*"],
  async main(ctx) {
    // The CSS variables every Optizzz style added to the game's pages reads.
    injectTheme(document);
    await runFeatures(features, new URL(location.href), await loadToggles(), ctx);
  },
});
