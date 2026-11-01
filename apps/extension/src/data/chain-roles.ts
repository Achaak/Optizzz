// The chain's roles of the account's spaces as the site hands them (docs/features/site-chaine.md), still encrypted with
// the Clé d'alliance: only the background opens them. Kept apart from the roles the player set in the chain, which they
// never overwrite. Forgotten with the Clé d'alliance (« Se déconnecter »).
import { storage } from "wxt/utils/storage";

const KEY = "local:optizzzAccount:chainRoles";

export interface KeptChainRoles {
  blob: string;
  revision: number;
}

type BySpace = Partial<Record<string, KeptChainRoles>>;

export async function loadChainRoles(spaceId: string): Promise<KeptChainRoles | null> {
  return (await storage.getItem<BySpace>(KEY))?.[spaceId] ?? null;
}

/** The site's answer: every space of the account that has roles (the others have none any more). */
export async function storeChainRoles(rows: readonly ({ spaceId: string } & KeptChainRoles)[]): Promise<void> {
  await storage.setItem<BySpace>(
    KEY,
    Object.fromEntries(rows.map(({ spaceId, blob, revision }) => [spaceId, { blob, revision }])),
  );
}

export async function forgetChainRoles(): Promise<void> {
  await storage.removeItem(KEY);
}

/** Calls `onChange` when the site's roles change: a chain, a map or a Members page open asks for them again. */
export const watchChainRoles = (onChange: () => void): (() => void) => storage.watch(KEY, onChange);
