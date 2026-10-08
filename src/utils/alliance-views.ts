// Optizzz views shown on alliance.php?Membres in place of the game's members table, each behind its own hash.
// Each view's script hides the game's content while any of them is open, so they never undo each other.
import { MAP_HASH } from "@/features/alliance-map/menu";
import { HISTORY_HASH } from "@/features/history/menu";
import { CHAIN_HASH } from "@/features/tdc-chain/menu";
import { isEnabled, type Toggles } from "@/features/toggles";

const VIEWS = [
  { hash: MAP_HASH, on: (toggles: Toggles) => isEnabled(toggles, "alliance-map") },
  { hash: CHAIN_HASH, on: (toggles: Toggles) => isEnabled(toggles, "tdc-chain") },
  { hash: HISTORY_HASH, on: (toggles: Toggles) => isEnabled(toggles, "history", "alliance") },
];

/** Hashes of the alliance views switched on: a link to a view switched off shows the members table. */
export const allianceViewHashes = (toggles: Toggles): string[] =>
  VIEWS.filter((view) => view.on(toggles)).map((view) => view.hash);

/** Whether the current page shows one of the Optizzz alliance views rather than the members table. */
export const showsAllianceView = (hashes: readonly string[]) =>
  location.search === "?Membres" && hashes.includes(location.hash);
