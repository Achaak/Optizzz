// Optizzz views shown on alliance.php?Membres in place of the game's members table, each behind its own hash.
// Each view's script hides the game's content while any of them is open, so they never undo each other.

const VIEW_HASHES = ["#carte", "#chaine"];

/** Whether the current page shows one of the Optizzz alliance views rather than the members table. */
export const showsAllianceView = () => location.search === "?Membres" && VIEW_HASHES.includes(location.hash);
