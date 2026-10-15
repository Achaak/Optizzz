import { loadPlayersExport } from "@/data/exports";
import { loadLevelsOf, unknownLevelsHint } from "@/data/levels";
import { readLoggedInPseudo, readMembersHuntingField } from "@/game/pages/alliance";
import { readChainSettings, watchChainSettings, type ChainSettings } from "@/features/tdc-chain/settings";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import {
  addMembersColumns,
  COLUMN_CLASS,
  MEMBERS_COLUMNS_STYLE,
  removeMembersColumns,
  type MembersColumnsContext,
} from "./mount";
import { rolesOfMembers } from "./roles";
import { tripsFrom } from "./trips";

/**
 * « Trajet » and « Rôle » columns in the members table: my trip to each member, its role in the TDC chain.
 * See docs/features/colonnes-membres.md.
 */
export const membersColumns: Feature = {
  id: "members-columns",
  toggle: "members-columns",
  matches: (url) => url.pathname.toLowerCase() === "/alliance.php" && url.search === "?Membres",
  async run(ctx, toggles) {
    const myPseudo = readLoggedInPseudo(document);
    const allianceContent = document.getElementById("alliance");
    if (!myPseudo || !allianceContent) return;
    const showTrips = isEnabled(toggles, "members-columns", "trips");
    // The roles are the chain's: none while the chain is switched off.
    const showRoles = isEnabled(toggles, "members-columns", "roles") && isEnabled(toggles, "tdc-chain");
    if (!showTrips && !showRoles) return;

    const [playersExport, levels, chainSettings] = await Promise.all([
      loadPlayersExport(location.origin).catch((error: unknown) => {
        console.warn("[Optizzz] members-columns: public export unavailable", error);
        return null;
      }),
      showTrips ? loadLevelsOf(location.origin, ["attackSpeed"]).catch((error: unknown) => ({ error })) : null,
      showRoles ? readChainSettings(location.host) : null,
    ]);
    const exportMissing = "L'export public de Fourmizzz ne répond pas : trajets indisponibles.";
    const trips: MembersColumnsContext["trips"] = !levels
      ? undefined
      : "error" in levels
        ? { byPseudo: null, missing: `${unknownLevelsHint(levels.error)} Les trajets en dépendent.` }
        : playersExport
          ? { byPseudo: tripsFrom(playersExport.players, myPseudo, levels.attackSpeed) }
          : { byPseudo: null, missing: exportMissing };

    let chain: ChainSettings | null = chainSettings;
    const style = document.createElement("style");
    style.textContent = MEMBERS_COLUMNS_STYLE;
    document.head.append(style);

    // The game fills #alliance over AJAX, and fills it again when the table changes: add the columns each time.
    const apply = () => {
      if (document.querySelector(`#tabMembresAlliance .${COLUMN_CLASS}`)) return;
      const roles =
        chain && playersExport
          ? rolesOfMembers(playersExport.players, myPseudo, readMembersHuntingField(document), chain)
          : undefined;
      addMembersColumns(document, { myPseudo, trips, roles }, new Date());
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(allianceContent, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    if (showRoles) {
      // Roles or colours changed in the chain (another tab): shown at once.
      const unwatch = watchChainSettings(location.host, (settings) => {
        chain = settings;
        removeMembersColumns(document);
        apply();
      });
      ctx.onInvalidated(unwatch);
    }
  },
};
