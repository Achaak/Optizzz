import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { Feature } from "./feature";
import { isEnabled, type Toggles } from "./toggles";

/** Runs the features that match the page and are switched on; one that fails is logged without stopping the others. */
export async function runFeatures(features: Feature[], url: URL, toggles: Toggles, ctx: ContentScriptContext) {
  for (const feature of features) {
    if (!feature.matches(url)) continue;
    if (feature.toggle && !isEnabled(toggles, feature.toggle)) continue;
    try {
      await feature.run(ctx, toggles);
    } catch (error) {
      console.error(`[Optizzz] feature "${feature.id}" failed`, error);
    }
  }
}
