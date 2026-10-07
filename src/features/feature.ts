import type { ContentScriptContext } from "wxt/utils/content-script-context";

/** A lightweight feature of the extension, enabled on some game pages. */
export interface Feature {
  id: string;
  /** Whether the feature applies to this URL. */
  matches: (url: URL) => boolean;
  run: (ctx: ContentScriptContext) => void | Promise<void>;
}
