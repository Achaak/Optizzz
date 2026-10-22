import { storage } from "wxt/utils/storage";
import type { RoleStyles } from "./role-styles";
import type { Role } from "./roles";

/** The chain, stored per server in the browser; keyed by player id. */
export interface ChainSettings {
  /** Null until the player sets them: the roles proposed from the fields are shown. */
  roles: Record<string, Role> | null;
  /** Field each hunter keeps. */
  keep: Record<string, number>;
  /** Bubble of each role on the map, chosen here. */
  styles: RoleStyles;
}

const DEFAULT_SETTINGS: ChainSettings = { roles: null, keep: {}, styles: {} };

const key = (host: string) => `local:tdcChain:${host}:settings` as const;

export async function readChainSettings(host: string): Promise<ChainSettings> {
  const stored = await storage.getItem<Partial<ChainSettings>>(key(host));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function writeChainSettings(host: string, settings: ChainSettings): Promise<void> {
  await storage.setItem(key(host), settings);
}

/** Calls `onChange` when the chain's settings change (roles and styles set in the chain, read by the map). */
export function watchChainSettings(host: string, onChange: (settings: ChainSettings) => void): () => void {
  return storage.watch<Partial<ChainSettings>>(key(host), (stored) => {
    onChange({ ...DEFAULT_SETTINGS, ...stored });
  });
}
