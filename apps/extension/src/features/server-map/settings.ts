import { storage } from "wxt/utils/storage";
import type { Chip } from "./selection";

/** What the map shows besides the chosen players (« Afficher : »). */
export interface MapDisplay {
  /** My marker drawn on the map. */
  showMe: boolean;
  /** The other players of the server, in grey. */
  others: boolean;
  /** Every chosen player's pseudo written, whatever the zoom. */
  allNames: boolean;
}

export const DEFAULT_DISPLAY: MapDisplay = { showMe: true, others: true, allNames: false };

/** What the server map remembers per server. */
export interface ServerMapSettings extends MapDisplay {
  /** Chips chosen last; null before the map was first opened. */
  chips: Chip[] | null;
}

const key = (host: string) => `local:serverMap:${host}:settings` as const;

export async function readServerMapSettings(host: string): Promise<ServerMapSettings> {
  return {
    chips: null,
    ...DEFAULT_DISPLAY,
    ...(await storage.getItem<Partial<ServerMapSettings>>(key(host))),
  };
}

export async function writeServerMapSettings(host: string, settings: ServerMapSettings): Promise<void> {
  await storage.setItem(key(host), settings);
}

/**
 * The player logged in on each server, and the server of the last game tab, kept by the content script: the map
 * opened from the toolbar popup knows neither.
 */
const LAST_SERVER_KEY = "local:serverMap:lastServer";
const pseudoKey = (host: string) => `local:serverMap:${host}:pseudo` as const;

export async function rememberPlayer(origin: string, pseudo: string | null): Promise<void> {
  await storage.setItem(LAST_SERVER_KEY, origin);
  if (pseudo) await storage.setItem(pseudoKey(new URL(origin).host), pseudo);
}

/** Origin of the last game tab, e.g. "https://s5.fourmizzz.fr". */
export function loadLastServer(): Promise<string | null> {
  return storage.getItem<string>(LAST_SERVER_KEY);
}

export function loadPlayerPseudo(origin: string): Promise<string | null> {
  return storage.getItem<string>(pseudoKey(new URL(origin).host));
}
