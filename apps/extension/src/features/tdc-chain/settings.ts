import { storage } from "wxt/utils/storage";
import type { RoleStyles } from "./role-styles";
import type { Role } from "@optizzz/game/tdc-chain/roles";

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

/** A granary stored before the granaries had ranks has none. */
type StoredRole = Role | { kind: "granary"; rank?: number };
type StoredSettings = Partial<Omit<ChainSettings, "roles"> & { roles: Record<string, StoredRole> | null }>;

/** Settings as stored; a granary without a rank is Grenier 1. */
function fromStored(stored: StoredSettings | null): ChainSettings {
  const { roles, ...rest } = { ...DEFAULT_SETTINGS, ...stored };
  if (!roles) return { ...rest, roles };
  const ranked = Object.entries(roles).map(([id, role]): [string, Role] => [
    id,
    role.kind === "granary" ? { kind: "granary", rank: role.rank ?? 1 } : role,
  ]);
  return { ...rest, roles: Object.fromEntries(ranked) };
}

export async function readChainSettings(host: string): Promise<ChainSettings> {
  return fromStored(await storage.getItem<StoredSettings>(key(host)));
}

export async function writeChainSettings(host: string, settings: ChainSettings): Promise<void> {
  await storage.setItem(key(host), settings);
}

/** Calls `onChange` when the chain's settings change (roles and styles set in the chain, read by the map). */
export function watchChainSettings(host: string, onChange: (settings: ChainSettings) => void): () => void {
  return storage.watch<StoredSettings>(key(host), (stored) => {
    onChange(fromStored(stored));
  });
}
