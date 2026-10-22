import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { FeatureId } from "./catalog";
import type { Toggles } from "./toggles";

/** A lightweight feature of the extension, enabled on some game pages. */
export interface Feature {
  id: string;
  /** Its entry in « Fonctionnalités »: the feature is skipped when switched off. None means always on. */
  toggle?: FeatureId;
  /** Whether the feature applies to this URL. */
  matches: (url: URL) => boolean;
  /** `toggles` lets the feature check its own options (`isEnabled`). */
  run: (ctx: ContentScriptContext, toggles: Toggles) => void | Promise<void>;
}
