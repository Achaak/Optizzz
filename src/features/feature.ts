import type { ContentScriptContext } from "wxt/utils/content-script-context";

/**
 * Une fonctionnalité de l'extension, activée sur certaines pages du jeu.
 */
export interface Feature {
  id: string;
  /** Indique si la fonctionnalité s'applique à cette URL. */
  matches: (url: URL) => boolean;
  run: (ctx: ContentScriptContext) => void | Promise<void>;
}
